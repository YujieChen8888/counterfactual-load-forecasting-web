"""
Loss functions for NACF.
"""

import torch
import torch.nn.functional as F
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity


def pdist2sq(A, B):
    """Compute pairwise squared Euclidean distances."""
    A_square = torch.sum(A ** 2, dim=1, keepdim=True)
    B_square = torch.sum(B ** 2, dim=1, keepdim=True)
    AB_product = torch.einsum('ik,jk->ij', A, B)
    D = A_square + B_square.T - 2 * AB_product
    return torch.clamp(D, min=0.0)


def rbf_kernel(A, B, rbf_sigma=1.0):
    """RBF kernel."""
    return torch.exp(-pdist2sq(A, B) / (rbf_sigma ** 2) * 0.5)


def calculate_mmd(A, B, rbf_sigma=1.0):
    """Compute Maximum Mean Discrepancy (MMD)."""
    Kaa = rbf_kernel(A, A, rbf_sigma)
    Kab = rbf_kernel(A, B, rbf_sigma)
    Kbb = rbf_kernel(B, B, rbf_sigma)
    return Kaa.mean() - 2 * Kab.mean() + Kbb.mean()


def treat_label(treatment, baseline, num_bins=20):
    """
    Group treatments by cosine similarity to the no-news baseline.

    treatment: (B, treat_dim)
    baseline: (1, treat_dim) encoded no-news baseline treatment.
    num_bins: number of treatment-intensity bins.

    Returns:
        labels: (B,) treatment-intensity group labels.
    """
    treatment_np = treatment.detach().cpu().numpy()
    baseline_np = baseline.detach().cpu().numpy()

    similarities = cosine_similarity(treatment_np, baseline_np)
    similarities = similarities.flatten()

    # Bin cosine similarities over the [-1, 1] range.
    bins = np.linspace(-1, 1.1, num_bins + 1)
    labels = np.digitize(similarities, bins, right=True)

    # Remap sparse bin ids to compact group labels.
    unique_labels = np.unique(labels)
    label_mapping = {label: idx for idx, label in enumerate(unique_labels)}
    new_labels = np.array([label_mapping[label] for label in labels])

    return new_labels


def ipm_loss(Z, w, labels, rbf_sigma=8.0):
    """
    Weighted IPM loss computed with an RBF-kernel MMD.

    Z: (B, hidden_dim) operating-context representation.
    w: (B, 1) or (B,) learned reweighting scores.
    labels: (B,) treatment-intensity group labels.
    """
    labels = np.array(labels)
    k = len(set(labels))

    if k <= 1:
        return torch.tensor(0.0, device=Z.device, requires_grad=True)

    if w.dim() == 2:
        w = w.mean(dim=1, keepdim=True)

    Zw = Z * w

    split_Z = [Z[labels == i] for i in set(labels)]
    split_Zw = [Zw[labels == i] for i in set(labels)]

    loss = torch.zeros(k, device=Z.device)

    for i in range(k):
        A = split_Zw[i]
        tmp_loss = torch.zeros(k - 1, device=Z.device)
        idx = 0
        for j in range(k):
            if i == j:
                continue
            B = split_Z[j]
            if len(A) > 0 and len(B) > 0:
                partial_loss = calculate_mmd(A, B, rbf_sigma)
                tmp_loss[idx] = partial_loss
            idx += 1
        loss[i] = tmp_loss.max()

    return loss.mean()


def rwt_regression_loss(w, y_true, y_pred):
    """Weighted regression loss."""
    losses = ((y_pred.squeeze() - y_true.squeeze()) ** 2) * w.squeeze()
    return losses.mean()


def calculate_loss(pred, target, Z, w, treatment, baseline,
                   lambda_ipm=0.1, rbf_sigma=8.0, num_bins=20):
    """
    Total objective = weighted MSE + lambda * IPM.

    pred: (B, pred_len) prediction.
    target: (B, pred_len) or (B,) target.
    Z: (B, hidden_dim) operating-context representation.
    w: (B, pred_len) learned reweighting scores.
    treatment: (B, treat_dim) treatment
    baseline: (1, treat_dim) baseline treatment
    lambda_ipm: IPM loss weight.
    rbf_sigma: RBF kernel bandwidth.
    num_bins: number of treatment-intensity bins.
    """
    loss_pred = rwt_regression_loss(w, target, pred)

    if lambda_ipm > 0:
        labels = treat_label(treatment, baseline, num_bins)
        w_mean = w.mean(dim=1, keepdim=True)  # (B, 1)
        loss_ipm = ipm_loss(Z, w_mean, labels, rbf_sigma)
    else:
        loss_ipm = torch.tensor(0.0, device=pred.device)

    total_loss = loss_pred + lambda_ipm * loss_ipm

    return total_loss, loss_pred, loss_ipm


def validation_loss(y_preds, y_trues):
    """Compute validation metrics."""
    y_preds = np.array(y_preds)
    y_trues = np.array(y_trues)

    mse = np.mean((y_preds - y_trues) ** 2)
    rmse = np.sqrt(mse)
    mae = np.mean(np.abs(y_preds - y_trues))
    mape = np.mean(np.abs((y_trues - y_preds) / (y_trues + 1e-8))) * 100

    return {
        'mse': mse,
        'rmse': rmse,
        'mae': mae,
        'mape': mape
    }
