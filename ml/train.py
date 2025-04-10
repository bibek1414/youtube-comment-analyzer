import pandas as pd
import numpy as np
import mlflow
import mlflow.sklearn
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, classification_report
import nltk
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
import re
import os

# Download NLTK resources
nltk.download('stopwords')
nltk.download('wordnet')
nltk.download('punkt')

# Set up MLflow
mlflow.set_experiment("youtube_comment_sentiment_analysis")

def preprocess_text(text):
    """Clean and preprocess text data"""
    if isinstance(text, str):
        text = text.lower()
        text = re.sub(r'https?://\S+|www\.\S+', '', text)
        text = re.sub(r'<.*?>', '', text)
        text = re.sub(r'[^\w\s]', '', text)
        text = re.sub(r'\d+', '', text)
        text = re.sub(r'\s+', ' ', text).strip()
        return text
    return ""

def load_and_prepare_data(twitter_path, reddit_path):
    """Load and prepare Twitter and Reddit datasets"""
    # Check if files exist
    if not os.path.exists(twitter_path):
        print(f"Error: {twitter_path} does not exist!")
        return pd.DataFrame()
    if not os.path.exists(reddit_path):
        print(f"Error: {reddit_path} does not exist!")
        return pd.DataFrame()
    
    # Load data
    try:
        twitter_data = pd.read_csv(twitter_path)
        reddit_data = pd.read_csv(reddit_path)
    except Exception as e:
        print(f"Error loading data: {e}")
        return pd.DataFrame()
    
    # Debug information
    print("Twitter data shape:", twitter_data.shape)
    print("Reddit data shape:", reddit_data.shape)
    print("Twitter data columns:", twitter_data.columns)
    print("Reddit data columns:", reddit_data.columns)
    
    # Check if dataframes are empty
    if twitter_data.empty or reddit_data.empty:
        print("Warning: One or both datasets are empty!")
        return pd.DataFrame()
    
    # Sample data for debugging
    print("\nTwitter data sample:")
    print(twitter_data.head(2))
    print("\nReddit data sample:")
    print(reddit_data.head(2))
    
    # Rename columns to unify them
    twitter_data = twitter_data.rename(columns={'clean_text': 'comment', 'category': 'label'})
    reddit_data = reddit_data.rename(columns={'clean_comment': 'comment', 'category': 'label'})
    
    # Convert label to string to ensure consistent processing
    twitter_data['label'] = twitter_data['label'].astype(str)
    reddit_data['label'] = reddit_data['label'].astype(str)
    
    # Debug before concatenation
    print(f"\nTwitter rows after renaming: {len(twitter_data)}")
    print(f"Reddit rows after renaming: {len(reddit_data)}")
    
    # Combine datasets
    combined_data = pd.concat([twitter_data, reddit_data], ignore_index=True)
    print(f"Combined rows before cleaning: {len(combined_data)}")
    
    # Preprocess text
    combined_data['cleaned_comment'] = combined_data['comment'].apply(preprocess_text)
    
    # Map sentiment labels to numeric values
    # Expanded mapping to handle different formats in the data
    sentiment_map = {
        'negative': 0, 'neutral': 1, 'positive': 2,
        '-1': 0, '0': 1, '1': 2,
        -1: 0, 0: 1, 1: 2
    }
    
    combined_data['sentiment'] = combined_data['label'].map(sentiment_map)
    print(f"Unique labels in combined data: {combined_data['label'].unique()}")
    print(f"Rows after sentiment mapping: {len(combined_data)}")
    
    # Drop rows with missing values
    combined_data_before_drop = len(combined_data)
    combined_data.dropna(subset=['cleaned_comment', 'sentiment'], inplace=True)
    print(f"Rows dropped: {combined_data_before_drop - len(combined_data)}")
    
    print(f"✅ Final combined dataset shape: {combined_data.shape}")
    print("🔍 Sample labels:\n", combined_data[['label', 'sentiment']].drop_duplicates())
    
    return combined_data

def create_sample_data():
    """Create sample data if real data is missing"""
    print("Creating sample data for demonstration...")
    
    # Create sample Twitter data
    twitter_sample = pd.DataFrame({
        'clean_text': [
            "I love this product, it's amazing!",
            "This is just okay, nothing special.",
            "Terrible experience, would not recommend."
        ],
        'category': ['1', '0', '-1']
    })
    
    # Create sample Reddit data
    reddit_sample = pd.DataFrame({
        'clean_comment': [
            "The service was outstanding and the staff was friendly.",
            "Not sure how I feel about this, seems average.",
            "Worst purchase I've ever made, complete waste of money."
        ],
        'category': ['1', '0', '-1']
    })
    
    # Save sample data
    os.makedirs('data', exist_ok=True)
    twitter_sample.to_csv('data/Twitter_Data.csv', index=False)
    reddit_sample.to_csv('data/Reddit_Data.csv', index=False)
    
    print("Sample data created successfully!")

def train_model():
    """Train sentiment analysis model and log with MLflow"""
    with mlflow.start_run():
        # Try to load data
        data = load_and_prepare_data('data/Twitter_Data.csv', 'data/Reddit_Data.csv')
        
        # If no data, create sample data and try again
        if data.empty:
            create_sample_data()
            data = load_and_prepare_data('data/Twitter_Data.csv', 'data/Reddit_Data.csv')
            
        if data.empty or len(data) < 5:
            print("Error: Not enough data to train the model")
            return None
            
        # Split data for training
        X_train, X_test, y_train, y_test = train_test_split(
            data['cleaned_comment'],
            data['sentiment'],
            test_size=0.2,
            random_state=42
        )
        
        print(f"Training set size: {len(X_train)}")
        print(f"Test set size: {len(X_test)}")

        # Create pipeline
        pipeline = Pipeline([
            ('tfidf', TfidfVectorizer(max_features=5000, min_df=2, max_df=0.8)),
            ('classifier', RandomForestClassifier(n_estimators=100, random_state=42))
        ])

        # Log parameters
        mlflow.log_param("model_type", "RandomForest")
        mlflow.log_param("n_estimators", 100)
        mlflow.log_param("max_features", 5000)

        # Train
        print("Training model...")
        pipeline.fit(X_train, y_train)

        # Predict
        y_pred = pipeline.predict(X_test)

        # Evaluate
        accuracy = accuracy_score(y_test, y_pred)
        precision, recall, f1, _ = precision_recall_fscore_support(y_test, y_pred, average='weighted')

        # Log metrics
        mlflow.log_metric("accuracy", accuracy)
        mlflow.log_metric("precision", precision)
        mlflow.log_metric("recall", recall)
        mlflow.log_metric("f1", f1)

        print("\n📊 Classification Report:\n", classification_report(y_test, y_pred))

        # Save model
        mlflow.sklearn.log_model(pipeline, "sentiment_analysis_model")
        
        # Save as pickled model as well for easy loading
        import pickle
        os.makedirs('models', exist_ok=True)
        with open('models/sentiment_model.pkl', 'wb') as f:
            pickle.dump(pipeline, f)
        print("Model saved to 'models/sentiment_model.pkl'")

        print(f"✅ Model training completed. Accuracy: {accuracy:.4f}")
        return pipeline

def test_prediction(model):
    """Test the model with a few examples"""
    if model is None:
        print("No model to test.")
        return
        
    test_comments = [
        "This video is amazing, I love it!",
        "Not sure what to think about this content.",
        "Terrible video, waste of time."
    ]
    
    print("\n🧪 Testing model with example comments:")
    for comment in test_comments:
        prediction = model.predict([comment])[0]
        sentiment = {0: "Negative", 1: "Neutral", 2: "Positive"}[prediction]
        print(f"Comment: \"{comment}\"")
        print(f"Prediction: {sentiment} (class {prediction})\n")

if __name__ == "__main__":
    model = train_model()
    test_prediction(model)