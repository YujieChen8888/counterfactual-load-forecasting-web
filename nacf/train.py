"""
Training and evaluation for NACF.
"""

import os
import json
import numpy as np
import torch
import torch.optim as optim
from torch.optim.lr_scheduler import CosineAnnealingLR
from tqdm import tqdm

from model import NACFModel
from dataset import get_dataloaders
from losses import calculate_loss
from utils import inverse_transform_predictions


class EarlyStopping:
    def __init__(self, patience=10):
        self.patience = patience
        self.counter = 0
        self.best_score = None
        self.early_stop = False

    def __call__(self, score):
        if self.best_score is None:
            self.best_score = score
        elif score < self.best_score:
            self.best_score = score
            self.counter = 0
        else:
            self.counter += 1
            if self.counter >= self.patience:
                self.early_stop = True
        return self.early_stop


class Trainer:
    def __init__(self, args):
        self.args = args
        self.device = torch.device(args.device)

        print("Loading data...")
        self.train_loader, self.val_loader, self.test_loader, self.scaler = get_dataloaders(args)

        print("Creating model...")
        print("Using NACF (Confounder Encoder + Treatment Encoder + Varying-Coefficient Response Network)")
        self.model = NACFModel(args).to(self.device)
        print(f"Parameters: {sum(p.numel() for p in self.model.parameters()):,}")

        self.optimizer = optim.AdamW(
            self.model.parameters(),
            lr=args.lr,
            weight_decay=args.weight_decay
        )

        self.scheduler = CosineAnnealingLR(self.optimizer, T_max=args.epochs, eta_min=1e-6)

        self.early_stopping = EarlyStopping(patience=args.patience)

        self.best_val_loss = float('inf')
        self.best_state = None
        self.history = {
            'train_loss': [],
            'train_pred_loss': [],
            'train_ipm_loss': [],
            'val_loss': [],
            'val_pred_loss': [],
            'val_ipm_loss': [],
            'lr': []
        }

    def train_epoch(self):
        self.model.train()
        total_loss = 0
        total_pred_loss = 0
        total_ipm_loss = 0
        n_batches = 0

        pbar = tqdm(self.train_loader, desc='Training', ncols=120)
        for batch in pbar:
            seq_x = batch['seq_x'].to(self.device)
            seq_y = batch['seq_y'].to(self.device)
            seq_x_mark = batch['seq_x_mark'].to(self.device)
            news_items = batch['news_items']
            news_mask = batch['news_mask'].to(self.device)
            news_metadata = batch['news_metadata']

            self.optimizer.zero_grad()

            pred, w, hidden, T = self.model(seq_x, seq_x_mark, news_items, news_mask, news_metadata)
            baseline = self.model.news_encoder.get_baseline(self.device)
            loss, loss_pred, loss_ipm = calculate_loss(
                pred, seq_y, hidden, w, T, baseline,
                lambda_ipm=self.args.lambda_ipm,
                rbf_sigma=self.args.rbf_sigma,
                num_bins=self.args.num_bins,
            )

            total_pred_loss += loss_pred.item()
            if isinstance(loss_ipm, torch.Tensor):
                total_ipm_loss += loss_ipm.item()

            loss.backward()
            torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
            self.optimizer.step()

            total_loss += loss.item()
            n_batches += 1

            pbar.set_postfix({
                'loss': f'{loss.item():.4f}',
                'pred': f'{loss_pred.item():.4f}',
                'ipm': f'{loss_ipm.item() if isinstance(loss_ipm, torch.Tensor) else 0:.4f}'
            })

        return {
            'total': total_loss / n_batches,
            'pred': total_pred_loss / n_batches,
            'ipm': total_ipm_loss / n_batches,
        }

    @torch.no_grad()
    def evaluate(self, loader, desc='Evaluating', return_preds=False):
        """
        Evaluate forecasting performance.

        Args:
            loader: data loader.
            desc: progress-bar label.
            return_preds: whether to return denormalized predictions.
        """
        self.model.eval()
        preds, trues = [], []
        total_loss = 0
        total_pred_loss = 0
        total_ipm_loss = 0
        n_batches = 0

        for batch in tqdm(loader, desc=desc, ncols=100):
            seq_x = batch['seq_x'].to(self.device)
            seq_y = batch['seq_y'].to(self.device)
            seq_x_mark = batch['seq_x_mark'].to(self.device)
            news_items = batch['news_items']
            news_mask = batch['news_mask'].to(self.device)
            news_metadata = batch['news_metadata']

            pred, w, hidden, T = self.model(seq_x, seq_x_mark, news_items, news_mask, news_metadata)
            baseline = self.model.news_encoder.get_baseline(self.device)
            loss, loss_pred, loss_ipm = calculate_loss(
                pred, seq_y, hidden, w, T, baseline,
                lambda_ipm=self.args.lambda_ipm,
                rbf_sigma=self.args.rbf_sigma,
                num_bins=self.args.num_bins,
            )
            total_loss += loss.item()
            total_pred_loss += loss_pred.item()
            if isinstance(loss_ipm, torch.Tensor):
                total_ipm_loss += loss_ipm.item()

            pred_np = inverse_transform_predictions(self.scaler, pred).flatten()
            true_np = inverse_transform_predictions(self.scaler, seq_y).flatten()

            preds.extend(pred_np.tolist())
            trues.extend(true_np.tolist())
            n_batches += 1

        preds = np.array(preds)
        trues = np.array(trues)

        mse = np.mean((preds - trues) ** 2)
        rmse = np.sqrt(mse)
        mae = np.mean(np.abs(preds - trues))
        mape = np.mean(np.abs((preds - trues) / (trues + 1e-8))) * 100
        mspe = np.mean(((preds - trues) / (trues + 1e-8)) ** 2) * 100

        metrics = {'mse': mse, 'rmse': rmse, 'mae': mae, 'mape': mape, 'mspe': mspe}

        metrics['loss'] = {
            'total': total_loss / n_batches,
            'pred': total_pred_loss / n_batches,
            'ipm': total_ipm_loss / n_batches,
        }

        if return_preds:
            return metrics, preds, trues
        return metrics

    def save_checkpoint(self, epoch, is_best=False):
        checkpoint = {
            'epoch': epoch,
            'model_state_dict': self.model.state_dict(),
            'optimizer_state_dict': self.optimizer.state_dict(),
            'best_val_loss': self.best_val_loss,
            'args': self.args
        }

        path = os.path.join(self.args.result_folder, 'checkpoint_latest.pth')
        torch.save(checkpoint, path)

        if is_best:
            path = os.path.join(self.args.result_folder, 'checkpoint_best.pth')
            torch.save(checkpoint, path)
            print(f"  -> Saved best model to {path}")

    def load_checkpoint(self, path):
        print(f"Loading checkpoint: {path}")
        checkpoint = torch.load(path, map_location=self.device, weights_only=False)
        state_dict = checkpoint.get('model_state_dict', checkpoint)
        load_result = self.model.load_state_dict(state_dict, strict=False)

        missing_keys = list(load_result.missing_keys)
        unexpected_keys = list(load_result.unexpected_keys)
        allowed_missing = all(
            key.startswith('news_encoder.encoder.')
            for key in missing_keys
        )

        if unexpected_keys:
            raise RuntimeError(f"Unexpected checkpoint keys: {unexpected_keys}")
        if missing_keys and not allowed_missing:
            raise RuntimeError(f"Missing required checkpoint keys: {missing_keys}")

        if missing_keys:
            print("Loaded public inference checkpoint; sentence encoder weights are provided by sentence-transformers.")

        if 'optimizer_state_dict' in checkpoint:
            self.optimizer.load_state_dict(checkpoint['optimizer_state_dict'])
        self.best_val_loss = checkpoint.get('best_val_loss', float('inf'))
        return checkpoint.get('epoch', 0)

    def train(self):
        print("\n" + "=" * 50)
        print("Starting Training")
        print(f"  lambda_ipm: {self.args.lambda_ipm}")
        print(f"  rbf_sigma: {self.args.rbf_sigma}")
        print(f"  num_bins: {self.args.num_bins}")
        print("=" * 50)

        start_epoch = 1
        if self.args.resume:
            start_epoch = self.load_checkpoint(self.args.resume) + 1

        for epoch in range(start_epoch, self.args.epochs + 1):
            train_result = self.train_epoch()

            val_metrics = self.evaluate(self.val_loader, 'Validating')

            self.scheduler.step()
            lr = self.scheduler.get_last_lr()[0]

            self.history['train_loss'].append(train_result['total'])
            self.history['val_loss'].append(val_metrics['loss']['total'])
            self.history['lr'].append(lr)
            self.history['train_pred_loss'].append(train_result['pred'])
            self.history['train_ipm_loss'].append(train_result['ipm'])
            self.history['val_pred_loss'].append(val_metrics['loss']['pred'])
            self.history['val_ipm_loss'].append(val_metrics['loss']['ipm'])

            print(f"\nEpoch {epoch}/{self.args.epochs}")
            print(f"  Train Loss: {train_result['total']:.4f} (pred: {train_result['pred']:.4f}, ipm: {train_result['ipm']:.4f})")
            print(f"  Val Loss: {val_metrics['loss']['total']:.4f} (pred: {val_metrics['loss']['pred']:.4f}, ipm: {val_metrics['loss']['ipm']:.4f})")
            print(f"  Val RMSE: {val_metrics['rmse']:.2f}, MAE: {val_metrics['mae']:.2f}, MAPE: {val_metrics['mape']:.2f}%")
            print(f"  LR: {lr:.6f}")

            is_best = val_metrics['rmse'] < self.best_val_loss
            if is_best:
                self.best_val_loss = val_metrics['rmse']
                self.best_state = self.model.state_dict().copy()
                print("  -> New best!")

            self.save_checkpoint(epoch, is_best)

            if self.early_stopping(val_metrics['rmse']):
                print(f"\nEarly stopping at epoch {epoch}")
                break

        history_path = os.path.join(self.args.result_folder, 'training_history.json')
        with open(history_path, 'w') as f:
            json.dump(self.history, f, indent=2)
        print(f"\nTraining history saved to: {history_path}")

        print("\n" + "=" * 50)
        print("Training Complete")
        print("=" * 50)

        if self.best_state:
            self.model.load_state_dict(self.best_state)

        self.test()

    def test(self):
        print("\n" + "=" * 50)
        print("Testing")
        print("=" * 50)

        print("\n[1/2] Factual evaluation (T=actual)...")
        factual_metrics, factual_preds, trues = self.evaluate(
            self.test_loader, 'Factual', return_preds=True
        )

        print("\n[2/2] Counterfactual evaluation (T=no-news baseline)...")
        counterfactual_preds = self._evaluate_counterfactual()

        mean_perturbation = np.mean(factual_preds - counterfactual_preds)

        print("\n" + "=" * 60)
        print("Counterfactual Evaluation Results")
        print("=" * 60)
        print("\n[Factual (T=actual)]")
        print(f"  MSE:  {factual_metrics['mse']:.2f}")
        print(f"  RMSE: {factual_metrics['rmse']:.2f}")
        print(f"  MAE:  {factual_metrics['mae']:.2f}")
        print(f"  MAPE: {factual_metrics['mape']:.2f}%")
        print(f"\n[Mean Estimated Demand Perturbation]")
        print(f"  Mean perturbation: {mean_perturbation:.2f}")

        self._save_counterfactual_results(
            factual_preds, counterfactual_preds, trues,
            factual_metrics, mean_perturbation
        )

        return factual_metrics, mean_perturbation

    @torch.no_grad()
    def _evaluate_counterfactual(self):
        """Evaluate forecasts under the no-news baseline treatment."""
        self.model.eval()
        preds = []

        for batch in tqdm(self.test_loader, desc='Counterfactual', ncols=100):
            seq_x = batch['seq_x'].to(self.device)
            seq_x_mark = batch['seq_x_mark'].to(self.device)
            B = seq_x.size(0)

            baseline = self.model.news_encoder.get_baseline(self.device)
            baseline_batch = baseline.expand(B, -1)
            pred, _, _, _ = self.model(seq_x, seq_x_mark, treatment=baseline_batch)

            pred_np = inverse_transform_predictions(self.scaler, pred).flatten()

            preds.extend(pred_np.tolist())

        preds = np.array(preds)

        return preds

    @torch.no_grad()
    def _save_counterfactual_results(self, factual_preds, counterfactual_preds, trues,
                                     factual_metrics, mean_perturbation):
        """Save factual and no-news baseline evaluation results."""
        save_dict = {
            'factual_preds': factual_preds,
            'counterfactual_preds': counterfactual_preds,
            'trues': trues,
            'mean_perturbation': mean_perturbation
        }
        npz_path = os.path.join(self.args.result_folder, 'counterfactual_results.npz')
        np.savez(npz_path, **save_dict)
        print(f"Counterfactual results saved to: {npz_path}")

        results = {
            'factual_metrics': {k: float(v) for k, v in factual_metrics.items() if k != 'loss'},
            'mean_perturbation': float(mean_perturbation),
        }

        json_path = os.path.join(self.args.result_folder, 'experiment_summary.json')
        with open(json_path, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"Experiment summary saved to: {json_path}")
