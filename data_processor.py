import requests
import pandas as pd
from sklearn.decomposition import PCA
from sklearn.ensemble import IsolationForest

def fetch_flight_data(origin=None, destination=None):
    """Fetch flight data from OpenSky Network API."""
    url = "https://opensky-network.org/api/states/all"
    try:
        response = requests.get(url, auth=('user', 'pass'))
        data = response.json()['states']
        return pd.DataFrame(data, columns=[
            'icao24', 'callsign', 'origin_country', 'time_position', 'last_contact',
            'lon', 'lat', 'altitude', 'on_ground', 'velocity', 'heading', 'vertical_rate',
            'sensors', 'geo_altitude', 'squawk', 'spi', 'position_source'
        ])
    except Exception as e:
        print(f"Error fetching data: {e}")
        return pd.DataFrame()

def preprocess_data(df):
    """Preprocess flight data with outlier detection and PCA."""
    iso_forest = IsolationForest(contamination=0.1)
    outliers = iso_forest.fit_predict(df)
    df_clean = df[outliers == 1]
    
    features = ['lat', 'lon', 'velocity', 'heading', 'altitude', 'wind_speed', 
                'turbulence_index', 'lightning_prob', 'temperature', 'pressure']
    X = df_clean[features]
    
    pca = PCA(n_components=5)
    X_pca = pca.fit_transform(X)
    
    return pd.DataFrame(X_pca, columns=[f'PC{i+1}' for i in range(5)])
