"""
ML Nowcasting Inference Service.
Maintains sliding temporal window of multimodal observations and generates real-time forecasts.
"""

import os
import torch
import numpy as np
from collections import deque
from pathlib import Path
from typing import Optional, Dict, Any, List
from models.architectures.convlstm_nowcaster import StormNowcastNet

class NowcastInferenceService:
    def __init__(self, device: str = "cpu", checkpoint_path: Optional[str] = None):
        self.device = torch.device(device if torch.cuda.is_available() and device != "cpu" else "cpu")
        self.model = StormNowcastNet(
            in_channels=5,
            out_channels=4,
            hidden_channels=32,
            t_in=4,
            t_out=12
        ).to(self.device)
        self.model.eval()

        self.checkpoint_path = checkpoint_path
        self._load_or_init_weights()

        self.frame_buffer = deque(maxlen=4)

    def _load_or_init_weights(self):
        if self.checkpoint_path and os.path.exists(self.checkpoint_path):
            try:
                state_dict = torch.load(self.checkpoint_path, map_location=self.device)
                self.model.load_state_dict(state_dict)
                print(f"Loaded ML checkpoint from {self.checkpoint_path}")
            except Exception as e:
                print(f"Warning: Could not load checkpoint ({e}). Using initialized weights.")
        else:
            # Save initialized weights to checkpoint path if directory exists
            if self.checkpoint_path:
                try:
                    os.makedirs(os.path.dirname(self.checkpoint_path), exist_ok=True)
                    torch.save(self.model.state_dict(), self.checkpoint_path)
                except Exception:
                    pass

    def add_frame(self, frame_5ch: np.ndarray):
        """Add a (5, H, W) normalized tensor frame to the rolling history."""
        self.frame_buffer.append(frame_5ch.astype(np.float32))

    def is_ready(self) -> bool:
        return len(self.frame_buffer) >= 4

    @torch.no_grad()
    def run_inference(self) -> Optional[Dict[str, Any]]:
        """
        Executes ConvLSTM forward pass over past 4 frames.
        Returns 12-step (0-120 min) future forecast grids.
        """
        if not self.is_ready():
            return None

        # Stack into (1, 4, 5, 128, 128)
        sequence = np.stack(list(self.frame_buffer), axis=0)  # (4, 5, H, W)
        x_tensor = torch.from_numpy(sequence).unsqueeze(0).to(self.device)  # (1, 4, 5, H, W)

        forecast = self.model(x_tensor)  # (1, 12, 4, H, W)
        forecast_np = forecast.squeeze(0).cpu().numpy()  # (12, 4, H, W)

        # Unpack channels:
        # 0: dbz normalized [0, 1] -> [0, 75]
        # 1: lightning [0, 1]
        # 2: rain rate [0, 1] -> [0, 150 mm/hr]
        # 3: downburst gust [0, 1] -> [0, 120 km/h]
        lead_times = []
        for step_idx in range(12):
            mins = (step_idx + 1) * 10
            dbz_pred = float(np.max(forecast_np[step_idx, 0]) * 75.0)
            rain_pred = float(np.max(forecast_np[step_idx, 2]) * 150.0)
            lightning_pred = float(np.sum(forecast_np[step_idx, 1]))
            gust_pred = float(np.max(forecast_np[step_idx, 3]) * 120.0)

            lead_times.append({
                "lead_time_min": mins,
                "predicted_max_dbz": round(dbz_pred, 1),
                "predicted_max_rain_rate_mm_hr": round(rain_pred, 1),
                "predicted_lightning_activity": round(lightning_pred, 1),
                "predicted_peak_gust_kmh": round(gust_pred, 1),
            })

        return {
            "forecast_available": True,
            "timesteps": lead_times,
            "horizon_minutes": 120
        }
