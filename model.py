import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Bidirectional, LSTM, Dense
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF
import numpy as np

class HTRPM:
    def __init__(self):
        self.model = self.build_bilstm_model()
        self.gpr = GaussianProcessRegressor(kernel=RBF())

    def build_bilstm_model(self):
        model = Sequential([
            Bidirectional(LSTM(64, return_sequences=True), input_shape=(None, 5)),
            Bidirectional(LSTM(32)),
            Dense(16, activation='relu'),
            Dense(1, activation='sigmoid')
        ])
        model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
        return model

    def preprocess_data(self, data):
        features = np.array([[ 
            data['temperature'],
            data['wind_speed'],
            data['pressure'],
            data['lightning_prob'],
            data['turbulence_index']
        ]])
        return features.reshape(1, -1, 5)

    def predict_risk(self, data):
        features = self.preprocess_data(data)
        bilstm_pred = self.model.predict(features)[0][0]
        gpr_pred, gpr_std = self.gpr.predict(features.reshape(1, -1), return_std=True)
        risk_score = 0.7 * bilstm_pred + 0.3 * gpr_pred[0]
        return float(risk_score)

    def train(self, X_train, y_train):
        self.model.fit(X_train, y_train, epochs=10, batch_size=32, validation_split=0.2)
        self.gpr.fit(X_train.reshape(X_train.shape[0], -1), y_train)
