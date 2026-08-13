from __future__ import annotations
import tensorflow as tf
from tensorflow.keras import layers, Model

def make_bilstm_vae(T:int=10, F:int=9, latent_dim:int=32, dropout=0.1):
    inputs = layers.Input(shape=(T, F), name="seq")
    x = layers.Bidirectional(layers.LSTM(64, return_sequences=True))(inputs)
    x = layers.Bidirectional(layers.LSTM(64))(x)
    x = layers.Dropout(dropout)(x)

    # VAE latent
    z_mu = layers.Dense(latent_dim, name="z_mu")(x)
    z_logvar = layers.Dense(latent_dim, name="z_logvar")(x)

    def reparam(args):
        mu, logvar = args
        eps = tf.random.normal(shape=tf.shape(mu))
        return mu + tf.exp(0.5 * logvar) * eps

    z = layers.Lambda(reparam, name="z")([z_mu, z_logvar])

    # simple decoder for recon loss
    d = layers.Dense(64, activation="relu")(z)
    d = layers.RepeatVector(T)(d)
    d = layers.LSTM(64, return_sequences=True)(d)
    recon = layers.TimeDistributed(layers.Dense(F), name="recon")(d)

    vae = Model(inputs, [z_mu, z_logvar, z, recon], name="bilstm_vae")
    return vae

@tf.function
def vae_loss_fn(y_true, y_pred, z_mu, z_logvar, recon_w=1.0, kl_w=0.001):
    recon_loss = tf.reduce_mean(tf.keras.losses.mse(y_true, y_pred))
    kl = -0.5 * tf.reduce_mean(1 + z_logvar - tf.square(z_mu) - tf.exp(z_logvar))
    return recon_w*recon_loss + kl_w*kl
