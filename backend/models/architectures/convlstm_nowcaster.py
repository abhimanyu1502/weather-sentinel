"""
Spatiotemporal Deep Learning Nowcasting Architecture using Convolutional LSTM (ConvLSTM).
Processes multi-channel radar + satellite + lightning sequences to forecast 0-120 min severe weather.
"""

import torch
import torch.nn as nn
from typing import Tuple, List

class ConvLSTMCell(nn.Module):
    def __init__(self, in_channels: int, hidden_channels: int, kernel_size: int = 3):
        super().__init__()
        self.in_channels = in_channels
        self.hidden_channels = hidden_channels
        padding = kernel_size // 2

        self.conv = nn.Conv2d(
            in_channels=in_channels + hidden_channels,
            out_channels=4 * hidden_channels,
            kernel_size=kernel_size,
            padding=padding,
            bias=True
        )

    def forward(
        self,
        x: torch.Tensor,
        hidden: Tuple[torch.Tensor, torch.Tensor]
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        h_prev, c_prev = hidden
        combined = torch.cat([x, h_prev], dim=1)
        gates = self.conv(combined)
        i, f, o, g = torch.chunk(gates, 4, dim=1)

        i = torch.sigmoid(i)
        f = torch.sigmoid(f)
        o = torch.sigmoid(o)
        g = torch.tanh(g)

        c_next = f * c_prev + i * g
        h_next = o * torch.tanh(c_next)
        return h_next, c_next

    def init_hidden(self, batch_size: int, height: int, width: int, device: torch.device) -> Tuple[torch.Tensor, torch.Tensor]:
        h = torch.zeros(batch_size, self.hidden_channels, height, width, device=device)
        c = torch.zeros(batch_size, self.hidden_channels, height, width, device=device)
        return h, c

class StormNowcastNet(nn.Module):
    def __init__(
        self,
        in_channels: int = 5,
        out_channels: int = 4,
        hidden_channels: int = 32,
        t_in: int = 4,
        t_out: int = 12
    ):
        super().__init__()
        self.t_in = t_in
        self.t_out = t_out
        self.hidden_channels = hidden_channels

        # Feature extraction encoder
        self.pre_conv = nn.Sequential(
            nn.Conv2d(in_channels, 24, kernel_size=3, padding=1),
            nn.GELU(),
            nn.Conv2d(24, hidden_channels, kernel_size=3, padding=1),
            nn.GELU()
        )

        # Spatiotemporal recurrent units
        self.encoder_cell = ConvLSTMCell(hidden_channels, hidden_channels, kernel_size=3)
        self.decoder_cell = ConvLSTMCell(hidden_channels, hidden_channels, kernel_size=3)

        # Multi-head forecast projector
        self.forecast_head = nn.Sequential(
            nn.Conv2d(hidden_channels, 24, kernel_size=3, padding=1),
            nn.GELU(),
            nn.Conv2d(24, out_channels, kernel_size=3, padding=1),
            nn.Sigmoid()  # Normalized physical forecast outputs [0, 1]
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Input: (B, T_in=4, C_in=5, H=128, W=128)
        Output: (B, T_out=12, C_out=4, H=128, W=128)
        Forecast channels: [0: dBZ, 1: Lightning, 2: Rain Rate, 3: Downburst Gust]
        """
        B, T, C, H, W = x.shape
        device = x.device

        h_enc, c_enc = self.encoder_cell.init_hidden(B, H, W, device)

        # Encode historical sequence
        for t in range(self.t_in):
            feat = self.pre_conv(x[:, t])
            h_enc, c_enc = self.encoder_cell(feat, (h_enc, c_enc))

        # Decode future horizon
        h_dec, c_dec = h_enc, c_enc
        outputs = []
        cur_input = h_enc

        for _ in range(self.t_out):
            h_dec, c_dec = self.decoder_cell(cur_input, (h_dec, c_dec))
            step_pred = self.forecast_head(h_dec)  # (B, 4, H, W)
            outputs.append(step_pred.unsqueeze(1))
            cur_input = h_dec

        return torch.cat(outputs, dim=1)
