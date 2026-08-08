"""
Utility functions for Counterfactual Load Forecasting.
"""

import numpy as np
import torch


def inverse_transform_predictions(scaler, predictions):
    """
    Inverse-transform normalized predictions.

    Args:
        scaler: sklearn scaler object
        predictions: torch.Tensor or np.ndarray, shape (B, pred_len) or (N,)

    Returns:
        np.ndarray: denormalized predictions
    """
    if isinstance(predictions, torch.Tensor):
        predictions = predictions.cpu().numpy()

    original_shape = predictions.shape
    predictions_flat = predictions.reshape(-1, 1)
    denormalized = scaler.inverse_transform(predictions_flat)

    if len(original_shape) == 1:
        return denormalized.flatten()
    else:
        return denormalized.reshape(original_shape)


def extract_sample_news(news_items, news_mask_sample, news_metadata, batch_idx, time_features=None):
    """
    Extract all news for a specific sample within a batch

    Args:
        news_items: (seq_len, B) list of lists - news items per timestep
        news_mask_sample: (seq_len,) boolean tensor for this sample
        news_metadata: (seq_len, B) list of lists - news metadata per timestep
        batch_idx: index within current batch
        time_features: (seq_len, 5) tensor - time features for this sample (optional)

    Returns:
        list of news item dicts, each containing:
            - timestep: int
            - type: str (Fact or Prediction)
            - text: str
            - category: str
            - scope: str
            - relevance_score: int
            - publication_time: str
            - source: str
            - justification: str
            - time_features: numpy array (5,) if time_features provided
    """
    extracted_news = []
    seq_len = news_mask_sample.shape[0]

    for t in range(seq_len):
        if news_mask_sample[t]:
            metadata_list = news_metadata[t][batch_idx]

            if metadata_list:
                for meta in metadata_list:
                    news_item = {
                        'timestep': t,
                        'type': meta.get('type', 'Unknown'),
                        'text': meta.get('text', ''),
                        'category': meta.get('category', ''),
                        'scope': meta.get('scope', ''),
                        'relevance_score': meta.get('relevance_score', 0),
                        'publication_time': meta.get('publication_time', ''),
                        'source': meta.get('source', ''),
                        'justification': meta.get('justification', '')
                    }

                    # Add time features if provided
                    if time_features is not None:
                        news_item['time_features'] = time_features[t].cpu().numpy()

                    extracted_news.append(news_item)

    return extracted_news


def denormalize_time_features(time_feat):
    """
    Convert normalized time features back to readable calendar fields.

    Args:
        time_feat: numpy array (5,) - normalized (month, day, weekday, hour, minute)

    Returns:
        dict with 'month', 'day', 'weekday', 'hour', 'minute' keys
    """
    return {
        'month': int((time_feat[0] + 0.5) * 12),
        'day': int((time_feat[1] + 0.5) * 31),
        'weekday': int((time_feat[2] + 0.5) * 7),
        'hour': int((time_feat[3] + 0.5) * 24),
        'minute': int((time_feat[4] + 0.5) * 60)
    }
