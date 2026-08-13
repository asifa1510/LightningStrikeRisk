from __future__ import annotations
import numpy as np

try:
    import gpflow
    from gpflow.kernels import Matern32
    GPFLOW_AVAILABLE = True
except Exception:
    GPFLOW_AVAILABLE = False

class GPRHead:
    """
    If GPflow is unavailable, this falls back to a simple linear head +
    MC-dropout uncertainty approximation provided by the caller.
    """
    def __init__(self):
        self._gp = None
        self._x_mean = None
        self._x_std = None

    def fit(self, X: np.ndarray, y: np.ndarray):
        # standardize
        self._x_mean = X.mean(0, keepdims=True)
        self._x_std  = X.std(0, keepdims=True) + 1e-6
        Xn = (X - self._x_mean) / self._x_std
        if GPFLOW_AVAILABLE:
            k = Matern32()
            self._gp = gpflow.models.GPR(data=(Xn, y[:, None]), kernel=k, mean_function=None)
            gpflow.optimizers.Scipy().minimize(self._gp.training_loss, self._gp.trainable_variables, options=dict(maxiter=200))
        else:
            # store a tiny ridge model for mean only
            XtX = Xn.T @ Xn + 1e-3*np.eye(Xn.shape[1])
            self._w = np.linalg.solve(XtX, Xn.T @ y)

    def predict(self, X: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        Xn = (X - self._x_mean) / self._x_std
        if GPFLOW_AVAILABLE and self._gp is not None:
            mean, var = self._gp.predict_y(Xn)
            return mean.numpy().ravel(), np.sqrt(var.numpy().ravel())
        # fallback: linear mean + fixed std from local variance
        m = Xn @ getattr(self, "_w", np.zeros(Xn.shape[1]))
        # cheap std proxy: local feature variance
        s = np.std(Xn, axis=1) * 0.2 + 0.1
        return m, s
