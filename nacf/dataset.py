"""
Dataset for Energy Demand Forecasting
"""

import json
from pathlib import Path
import numpy as np
import pandas as pd
import torch
from torch.utils.data import Dataset, DataLoader
from sklearn.preprocessing import StandardScaler


class EnergyDataset(Dataset):
    """Dataset for load, weather, calendar, and structured news-event inputs."""

    def __init__(self, args, flag='train'):
        self.args = args
        self.flag = flag
        self.seq_len = args.seq_len
        self.pred_len = args.pred_len
        # Sampling stride controls overlap between historical windows.
        self.sampling_stride = getattr(args, 'sampling_stride', 1)

        # Historical operating-context features.
        self.feature_cols = [
            'TOTALDEMAND', 'Is_Workday', 'Is_Aus_Holiday',
            'Min Temp (K)', 'Max Temp (K)', 'Max Wind Speed (m/s)',
            'Afternoon Humidity', 'Afternoon Pressure',
            'Morning Temp', 'Afternoon Temp'
        ]
        self.target_col = 'TOTALDEMAND'

        self._load_data()

    def _load_data(self):
        data_path = Path(getattr(self.args, 'data_path', './data/nsw_2019_structured_events.csv'))
        if not data_path.exists():
            raise FileNotFoundError(
                f"Dataset not found: {data_path}. Set --data_path to the released CSV file."
            )
        df = pd.read_csv(data_path)

        df['SETTLEMENTDATE'] = pd.to_datetime(df['SETTLEMENTDATE'])
        df = df.sort_values('SETTLEMENTDATE').reset_index(drop=True)

        self.df = df
        n = len(df)

        # Chronological split boundaries.
        train_end = int(n * self.args.train_ratio)
        val_end = int(n * (self.args.train_ratio + self.args.val_ratio))

        if self.flag == 'train':    
            self.start_idx = 0
            self.end_idx = train_end
        elif self.flag == 'val':
            self.start_idx = train_end
            self.end_idx = val_end
        else:  # test
            self.start_idx = val_end
            self.end_idx = n

        # Raw feature matrix.
        self.data = df[self.feature_cols].values

        # Time features: month, day, weekday, hour, minute.
        dates = pd.DatetimeIndex(df['SETTLEMENTDATE'])
        self.time_features = np.stack([
            dates.month / 12.0 - 0.5,
            dates.day / 31.0 - 0.5,
            dates.weekday / 6.0 - 0.5,
            dates.hour / 23.0 - 0.5,
            dates.minute / 59.0 - 0.5
        ], axis=1)

        # Fit normalization on the training split only.
        self.scaler = StandardScaler()
        train_data = df[self.feature_cols].values[:train_end]
        self.scaler.fit(train_data)
        self.data = self.scaler.transform(self.data)

        # Target scaler for denormalized reporting.
        self.target_scaler = StandardScaler()
        self.target_scaler.fit(df[[self.target_col]].values[:train_end])

        # Parse structured news events.
        self._parse_news()

        print(f"[{self.flag}] Loaded {len(self)} samples (rows {self.start_idx}-{self.end_idx})")

    def _parse_news(self):
        """
        Parse the event JSON column and keep each event as a separate item.

        The dataset uses the paper's structured event stream format, where the
        causal_events column stores a JSON array of extracted news events.
        Publication timestamps are converted once during loading for speed.
        """
        self.news_flags = []  # Whether each row has at least one event.
        self.news_items = []  # Event text list for each row.
        self.news_metadata = []  # Full event metadata for each row.

        for idx in range(len(self.df)):
            try:
                events = json.loads(self.df.iloc[idx]['causal_events'])

                if events and len(events) > 0:
                    news_list = []
                    metadata_list = []

                    for event in events:
                        event_type = event.get('type', 'Unknown')
                        text = event.get('text', '')
                        news_list.append(f"[{event_type.upper()}] {text}")

                        pub_time = event.get('publication_time', '')
                        pub_tf = self._parse_publication_time(pub_time)

                        metadata_list.append({
                            'type': event_type,
                            'text': text,
                            'category': event.get('category', ''),
                            'scope': event.get('scope', ''),
                            'relevance_score': event.get('relevance_score', 0),
                            'publication_time': pub_time,
                            'pub_tf': pub_tf,  # Precomputed publication-time features.
                            'source': event.get('source', ''),
                            'justification': event.get('justification', '')
                        })

                    self.news_flags.append(True)
                    self.news_items.append(news_list)
                    self.news_metadata.append(metadata_list)
                else:
                    self.news_flags.append(False)
                    self.news_items.append([])
                    self.news_metadata.append([])

            except Exception as e:
                raise ValueError(f"Failed to parse causal_events at row {idx}: {e}") from e

    def _parse_publication_time(self, pub_time_str):
        """
        Convert a publication_time string into normalized time features.

        Args:
            pub_time_str: timestamp string, for example "2019-01-01 18:55:00".

        Returns:
            numpy array: normalized [month, day, weekday, hour, minute] features.
        """
        if not pub_time_str or pd.isna(pub_time_str):
            return np.zeros(5, dtype=np.float32)

        try:
            dt = pd.to_datetime(pub_time_str)
            time_feat = np.array([
                dt.month / 12.0 - 0.5,
                dt.day / 31.0 - 0.5,
                dt.weekday() / 6.0 - 0.5,
                dt.hour / 23.0 - 0.5,
                dt.minute / 59.0 - 0.5
            ], dtype=np.float32)
        except Exception as e:
            print(f"Warning: Failed to parse publication_time '{pub_time_str}': {e}. Using zero vector.")
            time_feat = np.zeros(5, dtype=np.float32)

        return time_feat

    def __len__(self):
        max_start = self.end_idx - self.start_idx - self.seq_len - self.pred_len    
        if max_start < 0:
            return 0
        return (max_start // self.sampling_stride) + 1

    def __getitem__(self, index):
        actual_index = index * self.sampling_stride
        s_begin = self.start_idx + actual_index
        s_end = s_begin + self.seq_len
        r_end = s_end + self.pred_len

        # Historical input and future target sequence.
        seq_x = self.data[s_begin:s_end]  # (seq_len, enc_in)
        seq_y = self.data[s_end:r_end, 0]  # (pred_len,) target demand.

        # Time features.
        seq_x_mark = self.time_features[s_begin:s_end]
        seq_y_mark = self.time_features[s_end:r_end]

        # News events within the historical window.
        news_items = [self.news_items[i] for i in range(s_begin, s_end)]
        news_mask = [self.news_flags[i] for i in range(s_begin, s_end)]
        news_metadata = [self.news_metadata[i] for i in range(s_begin, s_end)]

        return {
            'seq_x': torch.FloatTensor(seq_x),
            'seq_y': torch.FloatTensor(seq_y),
            'seq_x_mark': torch.FloatTensor(seq_x_mark),
            'seq_y_mark': torch.FloatTensor(seq_y_mark),
            'news_items': news_items,
            'news_mask': torch.BoolTensor(news_mask),
            'news_metadata': news_metadata,
        }


def collate_fn(batch):
    """Collate variable-length event lists into timestep-major batches."""
    seq_x = torch.stack([b['seq_x'] for b in batch])
    seq_y = torch.stack([b['seq_y'] for b in batch])
    seq_x_mark = torch.stack([b['seq_x_mark'] for b in batch])
    seq_y_mark = torch.stack([b['seq_y_mark'] for b in batch])
    news_mask = torch.stack([b['news_mask'] for b in batch])

    # Convert event items to (seq_len, batch_size) nested lists.
    seq_len = len(batch[0]['news_items'])
    news_items = [[b['news_items'][t] for b in batch] for t in range(seq_len)]

    # Convert event metadata to (seq_len, batch_size) nested lists.
    news_metadata = [[b['news_metadata'][t] for b in batch] for t in range(seq_len)]

    return {
        'seq_x': seq_x,
        'seq_y': seq_y,
        'seq_x_mark': seq_x_mark,
        'seq_y_mark': seq_y_mark,
        'news_items': news_items,
        'news_mask': news_mask,
        'news_metadata': news_metadata,
    }


def get_dataloaders(args):
    """Create train, validation, and test data loaders."""
    train_set = EnergyDataset(args, 'train')
    val_set = EnergyDataset(args, 'val')
    test_set = EnergyDataset(args, 'test')

    # Share training-set scalers across splits.
    val_set.scaler = train_set.scaler
    val_set.target_scaler = train_set.target_scaler
    test_set.scaler = train_set.scaler
    test_set.target_scaler = train_set.target_scaler

    train_loader = DataLoader(
        train_set, batch_size=args.batch_size, shuffle=True,
        num_workers=args.num_workers, drop_last=True, collate_fn=collate_fn
    )
    val_loader = DataLoader(
        val_set, batch_size=args.batch_size, shuffle=False,
        num_workers=args.num_workers, collate_fn=collate_fn
    )
    test_loader = DataLoader(
        test_set, batch_size=args.batch_size, shuffle=False,
        num_workers=args.num_workers, collate_fn=collate_fn
    )

    return train_loader, val_loader, test_loader, train_set.target_scaler
