"""
News-Aware Counterfactual Load Analysis Framework (NACF).
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from sentence_transformers import SentenceTransformer


class FeedForward(nn.Module):
    """Position-wise feed-forward network."""
    def __init__(self, d_model, d_ff, dropout=0.1, activation='gelu'):
        super().__init__()
        self.fc1 = nn.Linear(d_model, d_ff)
        self.fc2 = nn.Linear(d_ff, d_model)
        self.dropout = nn.Dropout(dropout)
        self.activation = F.gelu if activation == 'gelu' else F.relu

    def forward(self, x):
        return self.fc2(self.dropout(self.activation(self.fc1(x))))


class EncoderLayer(nn.Module):
    """Transformer Encoder Layer"""
    def __init__(self, d_model, n_heads, d_ff, dropout=0.1, activation='gelu'):
        super().__init__()
        self.self_attn = nn.MultiheadAttention(d_model, n_heads, dropout=dropout, batch_first=True)
        self.ff = FeedForward(d_model, d_ff, dropout, activation)
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x):
        # Self attention
        attn_out, _ = self.self_attn(x, x, x)
        x = self.norm1(x + self.dropout(attn_out))
        # FFN
        x = self.norm2(x + self.dropout(self.ff(x)))
        return x


class NewsEncoder(nn.Module):
    """
    Treatment Encoder for time-stamped structured news events.

    Each event text is embedded with all-MiniLM-L6-v2, augmented with publication
    time features, and aggregated through a GRU to produce a continuous semantic
    treatment representation.
    """
    def __init__(self, args):
        super().__init__()
        self.treat_dim = 384  # MiniLM embedding dimension
        self.treat_hidden = getattr(args, 'treat_hidden', 128)  # GRU hidden dimension
        self.seq_len = args.seq_len

        # Frozen sentence encoder.
        self.encoder = SentenceTransformer('all-MiniLM-L6-v2')
        for param in self.encoder.parameters():
            param.requires_grad = False

        # Publication-time embedding: month, day, weekday, hour, minute.
        self.time_embed = nn.Sequential(
            nn.Linear(5, 64),
            nn.ReLU(),
            nn.Linear(64, self.treat_dim)
        )

        # Temporal aggregation over the historical news window.
        self.treat_gru = nn.GRU(self.treat_dim, self.treat_hidden, batch_first=True)

        # Encoded no-news baseline representation.
        self._init_baseline()

    def _init_baseline(self):
        """
        Encode the no-news baseline text in the same semantic space as news.
        """
        baseline_text = "No relevant news or information available"

        with torch.no_grad():
            baseline_embed = self.encoder.encode(
                baseline_text,
                convert_to_tensor=True,
                device='cpu'
            )  # (384,)
        baseline_embed = baseline_embed.detach().clone()

        # Register as a buffer so it is saved with the model and moved by .to().
        self.register_buffer('baseline_embed', baseline_embed.unsqueeze(0))  # (1, 384)

    def forward(self, news_items, news_mask, news_metadata):
        """
        Args:
            news_items: (seq_len, batch_size) nested lists of event texts.
            news_mask: (B, seq_len) boolean tensor indicating event presence.
            news_metadata: (seq_len, batch_size) nested metadata lists with
                precomputed publication-time features.

        Returns:
            treatment: (B, treat_hidden) continuous news-treatment representation.
        """
        B, T = news_mask.shape
        device = news_mask.device

        # Per-timestep treatment embeddings.
        treat_seq = torch.zeros(B, T, self.treat_dim, device=device)

        # Collect all event texts and publication-time features for batch encoding.
        all_texts = []
        all_time_feats = []
        news_positions = []  # [(b, t, count), ...]

        for b in range(B):
            for t in range(T):
                if news_mask[b, t]:
                    news_list = news_items[t][b]
                    metadata_list = news_metadata[t][b]

                    count = 0
                    for news_text, metadata in zip(news_list, metadata_list):
                        all_texts.append(news_text)
                        pub_tf = metadata.get('pub_tf')
                        all_time_feats.append(torch.from_numpy(pub_tf))
                        count += 1

                    if count > 0:
                        news_positions.append((b, t, count))

        if all_texts:
            with torch.no_grad():
                all_news_embeds = self.encoder.encode(
                    all_texts,
                    convert_to_tensor=True,
                    device=device
                )  # (total_news, 384)

            all_time_feats_tensor = torch.stack(all_time_feats).to(device)  # (total_news, 5)
            all_time_embeds = self.time_embed(all_time_feats_tensor)  # (total_news, 384)

            all_combined = all_news_embeds + all_time_embeds  # (total_news, 384)

            start_idx = 0
            for b, t, count in news_positions:
                end_idx = start_idx + count
                treat_seq[b, t] = all_combined[start_idx:end_idx].mean(dim=0)
                start_idx = end_idx

        # Use the baseline embedding for timesteps without relevant news.
        baseline = self.baseline_embed.squeeze(0).to(device)  # (384,)
        for b in range(B):
            for t in range(T):
                if not news_mask[b, t]:
                    treat_seq[b, t] = baseline

        gru_out, _ = self.treat_gru(treat_seq)  # (B, T, treat_hidden)
        treatment = gru_out[:, -1, :]  # (B, treat_hidden)

        return treatment

    def get_baseline(self, device):
        """
        Return the no-news baseline treatment after the same GRU aggregation.
        """
        baseline_seq = self.baseline_embed.expand(1, self.seq_len, -1).to(device)  # (1, seq_len, 384)
        gru_out, _ = self.treat_gru(baseline_seq)  # (1, seq_len, treat_hidden)
        return gru_out[:, -1, :]  # (1, treat_hidden)


class Truncated_power(nn.Module):
    """Truncated power basis used by the varying-coefficient network."""
    def __init__(self, degree, knots):
        super().__init__()
        self.degree = degree
        self.knots = knots
        self.num_of_basis = degree + 1 + len(knots)
        self.relu = nn.ReLU(inplace=True)

    def forward(self, x):
        if x.dim() == 2:
            x = x.mean(dim=-1)
        x = x.squeeze()
        if x.dim() == 0:
            x = x.unsqueeze(0)
        out = torch.zeros(x.shape[0], self.num_of_basis, device=x.device)
        for i in range(self.num_of_basis):
            if i <= self.degree:
                out[:, i] = x ** i
            else:
                out[:, i] = self.relu(x - self.knots[i - self.degree - 1]) ** self.degree
        return out


class Dynamic_FC(nn.Module):
    """Dynamic fully connected layer with treatment-dependent coefficients."""
    def __init__(self, ind, outd, degree, knots, treat_dim, act='relu', isbias=1, islastlayer=0):
        super().__init__()
        self.ind = ind
        self.outd = outd
        self.treat_dim = treat_dim
        self.islastlayer = islastlayer
        self.isbias = isbias

        self.spb = Truncated_power(degree, knots)
        self.d = self.spb.num_of_basis

        self.weight = nn.Parameter(torch.rand(ind, outd, self.d), requires_grad=True)
        if isbias:
            self.bias = nn.Parameter(torch.rand(outd, self.d), requires_grad=True)
        else:
            self.bias = None

        self.act = nn.ReLU() if act == 'relu' else None

    def forward(self, x):
        # x: (B, treat_dim + feature_dim)
        x_treat = x[:, :self.treat_dim]
        x_feature = x[:, self.treat_dim:]

        x_feature_weight = torch.einsum('bi,iod->bod', x_feature, self.weight)  # (B, outd, d)
        x_treat_basis = self.spb(x_treat)  # (B, d)
        x_treat_basis_ = x_treat_basis.unsqueeze(1)
        out = torch.sum(x_feature_weight * x_treat_basis_, dim=2)  # (B, outd)

        if self.isbias:
            out_bias = torch.matmul(self.bias, x_treat_basis.T).T
            out = out + out_bias

        if self.act is not None:
            out = self.act(out)

        if not self.islastlayer:
            out = torch.cat((x_treat, out), dim=1)

        return out


class VaryingCoefficientResponseNetwork(nn.Module):
    """Varying-Coefficient Response Network from the NACF paper."""
    def __init__(self, args):
        super().__init__()
        self.args = args
        input_dim = args.d_model  # Operating-context representation dimension
        treat_dim = getattr(args, 'treat_hidden', 128)  # Treatment representation dimension
        output_dim = args.pred_len

        self.treat_dim = treat_dim
        self.degree = 2
        self.knots = [0.33, 0.66]

        # Treatment-dependent forecasting surface.
        self.out = nn.Sequential(
            Dynamic_FC(input_dim, input_dim, self.degree, self.knots, treat_dim, act='relu', islastlayer=0),
            Dynamic_FC(input_dim, output_dim, self.degree, self.knots, treat_dim, act='id', islastlayer=1)
        )

        # Learned sample reweighting network.
        self.rwt = nn.Sequential(
            Dynamic_FC(input_dim, input_dim, self.degree, self.knots, treat_dim, act='relu', islastlayer=0),
            Dynamic_FC(input_dim, output_dim, self.degree, self.knots, treat_dim, act='id', islastlayer=1)
        )

        self._init_weights()

    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, Dynamic_FC):
                m.weight.data.normal_(0, 0.1)
                if m.isbias:
                    m.bias.data.zero_()
            elif isinstance(m, nn.Linear):
                m.weight.data.normal_(0, 0.1)
                if m.bias is not None:
                    m.bias.data.zero_()

    def forward(self, z, treat):
        """
        z: (B, d_model) operating-context representation.
        treat: (B, treat_dim) continuous news-treatment representation.
        """
        if treat.dim() == 1:
            treat = treat.unsqueeze(1)

        t_hidden = torch.cat((treat, z), dim=1)  # (B, 384+256)

        w = self.rwt(t_hidden)
        w = torch.sigmoid(w) * 2
        w = torch.exp(w) / torch.exp(w).sum(dim=0) * w.shape[0]

        out = self.out(t_hidden)  # (B, pred_len)

        return out, w, z  # z is used by the IPM balance regularizer.


class NACFModel(nn.Module):
    """News-Aware Counterfactual Load Analysis Framework."""
    def __init__(self, args):
        super().__init__()
        self.args = args

        self.seq_len = args.seq_len
        self.pred_len = args.pred_len
        self.enc_in = args.enc_in
        self.d_model = args.d_model

        # Confounder Encoder: inverted variable-token attention over history.
        self.var_embedding = nn.Linear(args.seq_len, args.d_model)
        self.var_pos_embed = nn.Parameter(torch.randn(1, args.enc_in, args.d_model) * 0.02)
        self.encoder_layers = nn.ModuleList([
            EncoderLayer(args.d_model, args.n_heads, args.d_ff, args.dropout, args.activation)
            for _ in range(args.e_layers)
        ])
        self.encoder_norm = nn.LayerNorm(args.d_model)

        # Treatment Encoder.
        self.news_encoder = NewsEncoder(args)

        # Varying-Coefficient Response Network.
        self.response_network = VaryingCoefficientResponseNetwork(args)

        self._init_weights()

    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Linear) and not hasattr(m, 'isbias'):
                if not any(isinstance(p, Dynamic_FC) for p in [m]):
                    nn.init.xavier_uniform_(m.weight)
                    if m.bias is not None:
                        nn.init.zeros_(m.bias)

    def forward(self, x, x_mark, news_items=None, news_mask=None, news_metadata=None, treatment=None):
        """
        Args:
            x: (B, seq_len, enc_in) historical multivariate time series.
            x_mark: (B, seq_len, 5) time features retained for interface compatibility.
            news_items: nested event-text lists used for factual prediction.
            news_mask: event-presence mask used for factual prediction.
            news_metadata: event metadata, including publication-time features.
            treatment: optional precomputed treatment for baseline comparisons.

        Returns:
            pred: (B, pred_len) load forecast.
            w: (B, pred_len) learned reweighting scores.
            hidden: (B, hidden_dim) operating-context representation.
            T: (B, treat_dim) news-treatment representation.
        """
        # Instance Normalization
        means = x.mean(dim=1, keepdim=True)
        stdev = (x.var(dim=1, keepdim=True, unbiased=False) + 1e-5).sqrt()
        x_norm = (x - means) / stdev

        # Confounder Encoder.
        x_t = x_norm.permute(0, 2, 1)
        x_t = self.var_embedding(x_t)
        x_t = x_t + self.var_pos_embed

        for layer in self.encoder_layers:
            x_t = layer(x_t)
        x_t = self.encoder_norm(x_t)

        # Use the target-variable token as the operating-context representation.
        Z = x_t[:, 0, :]  # (B, d_model)

        # Use an externally supplied treatment for no-news baseline comparisons.
        if treatment is not None:
            T = treatment
        else:
            T = self.news_encoder(news_items, news_mask, news_metadata)

        pred, w, hidden = self.response_network(Z, T)

        pred = pred * stdev[:, 0, 0:1] + means[:, 0, 0:1]

        return pred, w, hidden, T
