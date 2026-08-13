from __future__ import annotations
import os, joblib, numpy as np, tensorflow as tf
from sklearn.model_selection import train_test_split
from models.bilstm_vae import make_bilstm_vae, vae_loss_fn
from models.gpr_head import GPRHead

T, F, LATENT = 10, 9, 32
CKPT = "artifacts/bilstm_vae"
GPR_PATH = "artifacts/gpr_head.pkl"
os.makedirs("artifacts", exist_ok=True)

def toy_dataset(n=2000):
    # synthesize (X, y) with meteorological couplings; replace with real data loader later
    X = np.random.normal(size=(n, T, F)).astype("float32")
    # interpret columns 6,7,8 as WS, Temp, Press
    WS = X[:,:,6].mean(1)
    Temp = X[:,:,7].mean(1)
    Press = X[:,:,8].mean(1)
    # toy label: higher WS/Temp and lower Press -> higher risk
    y = 1/(1 + np.exp(- (0.8*WS + 0.6*Temp - 0.5*Press)))
    y = (y - y.min())/(y.max()-y.min()+1e-6)
    return X, y

def train():
    X, y = toy_dataset()
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42)

    vae = make_bilstm_vae(T=T, F=F, latent_dim=LATENT)
    opt = tf.keras.optimizers.Adam(1e-3)

    # VAE training for few epochs (demo)
    for epoch in range(8):
        with tf.GradientTape() as tape:
            z_mu, z_logvar, z, recon = vae(Xtr, training=True)
            loss = vae_loss_fn(Xtr, recon, z_mu, z_logvar, recon_w=1.0, kl_w=0.001)
        grads = tape.gradient(loss, vae.trainable_variables)
        opt.apply_gradients((g,v) for g,v in zip(grads, vae.trainable_variables) if g is not None)
        print(f"epoch {epoch+1} - vae loss {loss.numpy():.4f}")

    vae.save_weights(CKPT)

    # extract latent z for GPR train
    z_tr = vae(Xtr, training=False)[2].numpy()
    # enrich with last-step met features (columns 6..8)
    meta_tr = Xtr[:,-1,6:9]
    Xgpr_tr = np.concatenate([z_tr, meta_tr], axis=1)
    gpr = GPRHead()
    gpr.fit(Xgpr_tr, ytr)
    joblib.dump(gpr, GPR_PATH)
    print("Saved:", CKPT, GPR_PATH)

if __name__ == "__main__":
    train()
