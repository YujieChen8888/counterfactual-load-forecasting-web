"""
Configuration for Counterfactual Load Forecasting
"""

import argparse
import os
import torch


def get_args():
    parser = argparse.ArgumentParser(description='Counterfactual Load Forecasting')

    # Data
    parser.add_argument('--state', type=str, default='NSW')
    parser.add_argument('--data_path', type=str, default='./data/nsw_2019_structured_events.csv')
    parser.add_argument('--train_ratio', type=float, default=0.7)
    parser.add_argument('--val_ratio', type=float, default=0.1)
    parser.add_argument('--test_ratio', type=float, default=0.2)

    # Sequence
    parser.add_argument('--seq_len', type=int, default=48, help='Input sequence length')
    parser.add_argument('--pred_len', type=int, default=48, help='Prediction length')
    parser.add_argument('--sampling_stride', type=int, default=1, help='Sampling stride')

    # Model
    parser.add_argument('--enc_in', type=int, default=10, help='Number of input features')
    parser.add_argument('--d_model', type=int, default=512, help='Model dimension')
    parser.add_argument('--n_heads', type=int, default=8, help='Number of attention heads')
    parser.add_argument('--e_layers', type=int, default=2, help='Number of encoder layers')
    parser.add_argument('--d_ff', type=int, default=2048, help='FFN dimension')
    parser.add_argument('--dropout', type=float, default=0.1)
    parser.add_argument('--activation', type=str, default='gelu')

    # NACF counterfactual components
    parser.add_argument('--treat_hidden', type=int, default=128, help='GRU hidden dim for treatment')
    parser.add_argument('--lambda_ipm', type=float, default=1.2, help='IPM loss weight')
    parser.add_argument('--rbf_sigma', type=float, default=8.0, help='RBF kernel bandwidth')
    parser.add_argument('--num_bins', type=int, default=20, help='Number of bins for treatment grouping')

    # Training
    parser.add_argument('--batch_size', type=int, default=128)
    parser.add_argument('--epochs', type=int, default=100)
    parser.add_argument('--lr', type=float, default=1e-3)
    parser.add_argument('--weight_decay', type=float, default=1e-5)
    parser.add_argument('--patience', type=int, default=5)
    parser.add_argument('--num_workers', type=int, default=4)

    # Save
    parser.add_argument('--save_dir', type=str, default='./checkpoints')
    parser.add_argument('--results_dir', type=str, default='./results')
    parser.add_argument('--exp_name', type=str, default='counterfactual_load_forecasting')

    # Device
    parser.add_argument('--device', type=str, default='cuda')
    parser.add_argument('--seed', type=int, default=42)

    # Mode
    parser.add_argument('--mode', type=str, default='train', choices=['train', 'test'])
    parser.add_argument('--resume', type=str, default=None)

    args = parser.parse_args()

    # Auto device
    if args.device == 'cuda' and torch.cuda.is_available():
        args.device = 'cuda:0'
    else:
        args.device = 'cpu'

    # Use non-overlapping windows if sampling_stride is left unspecified.
    if args.sampling_stride is None:
        args.sampling_stride = args.seq_len

    # Create output directories.
    os.makedirs(args.save_dir, exist_ok=True)
    os.makedirs(args.results_dir, exist_ok=True)

    exp_folder = (
        f"{args.state}_nacf_sl{args.seq_len}_pl{args.pred_len}_"
        f"dm{args.d_model}_nh{args.n_heads}_el{args.e_layers}_df{args.d_ff}_do{args.dropout}_"
        f"bs{args.batch_size}_lr{args.lr}_wd{args.weight_decay}_"
        f"ip{args.lambda_ipm}_rb{args.rbf_sigma}_bn{args.num_bins}_sd{args.seed}"
    )

    args.result_folder = os.path.join(args.results_dir, exp_folder)
    os.makedirs(args.result_folder, exist_ok=True)

    # Build a timestamped log path from the experiment configuration.
    from datetime import datetime
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    args.log_path = os.path.join(args.result_folder, f'{exp_folder}_{timestamp}.log')

    return args


def print_args(args):
    print("=" * 50)
    print("Configuration")
    print("=" * 50)
    for k, v in vars(args).items():
        print(f"  {k}: {v}")
    print("=" * 50)
