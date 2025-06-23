import requests
import pandas as pd
from sklearn.decomposition import PCA
from sklearn.ensemble import IsolationForest

def fetch_flight_data(origin=None, destination=None):
    """Fetch flight data from OpenSky Network API."""
    url = "https://opensky-network.org/api/states/all"
    try:
        response = requests.get(url)
        data = response.json()['states']
        df = pd.DataFrame(data, columns=[
            'icao24', 'callsign', 'origin_country', 'time_position', 'last_contact',
            'lon', 'lat', 'altitude', 'on_ground', 'velocity', 'heading', 'vertical_rate',
            'sensors', 'geo_altitude', 'squawk', 'spi', 'position_source'
        ])
        if origin:
            df = df[df['origin_country'].str.contains(origin, case=False, na=False)]
        if destination:
            df['landing_location'] = destination  # Simplified for demo
        return df
    except Exception as e:
        print(f"Error fetching data: {e}")
        return pd.DataFrame()

def preprocess_data(df):
    """Preprocess flight data with outlier detection and PCA."""
    if df.empty:
        return df
    iso_forest = IsolationForest(contamination=0.1)
    features = ['lat', 'lon', 'velocity', 'heading', 'altitude']
    X = df[features].fillna(0)
    outliers = iso_forest.fit_predict(X)
    df_clean = df[outliers == 1].copy()
    pca = PCA(n_components=3)
    X_pca = pca.fit_transform(X[outliers == 1])
    df_clean[['PC1', 'PC2', 'PC3']] = X_pca
    return df_clean
