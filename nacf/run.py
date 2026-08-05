"""
Main entry point
"""

import os
os.environ['TOKENIZERS_PARALLELISM'] = 'false'

import torch
import numpy as np
import random
from pathlib import Path

from config import get_args, print_args
from train import Trainer


def set_seed(seed):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
        torch.backends.cudnn.deterministic = True


def main():
    args = get_args()
    print_args(args)

    print("\n" + "=" * 50)
    print(f"Log file: {args.log_path}")
    print(f"Suggested command: python run.py [your args] 2>&1 | tee {args.log_path}")
    print("=" * 50 + "\n")

    set_seed(args.seed)

    trainer = Trainer(args)

    if args.mode == 'train':
        trainer.train()
    elif args.mode == 'test':
        checkpoint_path = args.resume
        if checkpoint_path is None:
            public_checkpoint = Path('./weights/nacf_nsw_2019_public.pth')
            if public_checkpoint.exists():
                checkpoint_path = str(public_checkpoint)
        if checkpoint_path is None:
            raise FileNotFoundError(
                "No checkpoint provided. Set --resume or add weights/nacf_nsw_2019_public.pth."
            )
        trainer.load_checkpoint(checkpoint_path)
        trainer.test()


if __name__ == '__main__':
    main()
