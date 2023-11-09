# import sys

# def rtas():
#     v = "done"
#     print(v)
    




# if sys.argv[1] == 'rtas':
#     rtas()

# sys.stdout.flush()    

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from statsmodels.tsa.arima.model import ARIMA
from dateutil.parser import parse

# Load the historical Bitcoin price data into a Pandas dataframe
df = pd.read_csv("./BTC-USD-current-price.csv", header=None, names=["Date", "Price"])

# Remove rows where 'Date' column equals to "Date" (the column name itself)
df = df[df['Date'] != "Date"]

df['Date'] = df['Date'].apply(parse)  # Use dateutil's parse method
df = df.set_index("Date")
df["Price"] = df["Price"].astype(float)

# Set the frequency of the dataframe to daily
df = df.asfreq('D')

# Split the data into training and testing sets
train = df[:int(0.8*(len(df)))]
test = df[int(0.8*(len(df))):]

# Fit an ARIMA model to the training data
model = ARIMA(train["Price"], order=(1,1,1))
model = model.fit()

# Make predictions for the next 30 days
predictions = model.forecast(steps=120).values

# Use Monte Carlo simulation to generate 1000 scenarios for the next 30 days
num_simulations = 1000
num_steps = 120
simulated_prices = np.zeros((num_simulations, num_steps))
for i in range(num_simulations):
    simulated_prices[i,:] = predictions + np.random.normal(0, model.resid.std(), num_steps)

print(simulated_prices)
# Plot the results of the Monte Carlo simulation
plt.figure(figsize=(10,5))
plt.plot(simulated_prices.T, color='gray', alpha=0.1)  # Use alpha for better visualization
plt.plot(predictions, color='red', label='ARIMA Forecast')
plt.xlabel("Time (days)")
plt.ylabel("Price (USD)")
plt.title("Monte Carlo Simulation of Future Bitcoin Prices")
plt.legend()
plt.show()
plt.savefig('plot.png')