#config.py
class CFG:
    # weights for paper risk formula R = αT + βWS + γP + δL + ηTI
    ALPHA = 0.20   # temperature
    BETA  = 0.18   # wind speed
    GAMMA = 0.10   # pressure (proxy congestion/alt weather)
    DELTA = 0.28   # lightning probability
    ETA   = 0.24   # turbulence index
