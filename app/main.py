import os
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import mlflow.sklearn
import googleapiclient.discovery
import googleapiclient.errors
from dotenv import load_dotenv
import logging
import json
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="YouTube Comment Analyzer API")

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class VideoRequest(BaseModel):
    video_id: str
    max_comments: int = 100

class Comment(BaseModel):
    text: str
    author: str
    like_count: int
    published_at: str

class CommentAnalysisRequest(BaseModel):
    comments: List[str]

class CommentAnalysisResponse(BaseModel):
    results: List[Dict[str, Any]]
    summary: Dict[str, Any]

# Global variable for the model
sentiment_model = None

# Load the sentiment analysis model
def load_model():
    global sentiment_model
    try:
        # Load the model from MLflow
        model_path = os.getenv("MODEL_PATH")
        sentiment_model = mlflow.sklearn.load_model(model_path)
        logger.info("Model loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        sentiment_model = None

# Initialize API
@app.on_event("startup")
async def startup_event():
    load_model()

# Analyze comments endpoint
@app.post("/analyze", response_model=CommentAnalysisResponse)
async def analyze_comments(request: CommentAnalysisRequest):
    global sentiment_model
    
    if sentiment_model is None:
        load_model()
        if sentiment_model is None:
            raise HTTPException(status_code=500, detail="Model not available")
    
    try:
        # Make predictions
        predictions = sentiment_model.predict(request.comments)
        
        # Get probabilities if available
        probabilities = []
        if hasattr(sentiment_model, "predict_proba"):
            probabilities = sentiment_model.predict_proba(request.comments)
        
        # Prepare results
        results = []
        sentiments = {0: "negative", 1: "neutral", 2: "positive"}
        sentiment_counts = {label: 0 for label in sentiments.values()}
        
        for i, (comment, prediction) in enumerate(zip(request.comments, predictions)):
            sentiment = sentiments[prediction]
            sentiment_counts[sentiment] += 1
            
            result = {
                "comment": comment,
                "sentiment": sentiment,
                "sentiment_id": int(prediction)
            }
            
            # Add probabilities if available
            if len(probabilities) > 0:
                result["probabilities"] = {
                    sentiments[j]: float(prob) 
                    for j, prob in enumerate(probabilities[i])
                }
            
            results.append(result)
        
        # Calculate summary
        total = len(request.comments)
        summary = {
            "total_comments": total,
            "sentiment_distribution": {
                sentiment: {
                    "count": count,
                    "percentage": (count / total) * 100 if total > 0 else 0
                }
                for sentiment, count in sentiment_counts.items()
            }
        }
        
        return {"results": results, "summary": summary}
    
    except Exception as e:
        logger.error(f"Error analyzing comments: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing comments: {str(e)}")

# YouTube API endpoint to fetch comments
@app.post("/fetch-comments", response_model=List[Comment])
async def fetch_comments(request: VideoRequest):
    try:
        # Initialize YouTube API client
        api_key = os.getenv("YOUTUBE_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="YouTube API key not configured")
        
        youtube = googleapiclient.discovery.build(
            "youtube", "v3", developerKey=api_key
        )
        
        # Fetch comments
        request = youtube.commentThreads().list(
            part="snippet",
            videoId=request.video_id,
            maxResults=request.max_comments,
            textFormat="plainText"
        )
        response = request.execute()
        
        # Process comments
        comments = []
        for item in response.get("items", []):
            snippet = item["snippet"]["topLevelComment"]["snippet"]
            comments.append(
                Comment(
                    text=snippet["textDisplay"],
                    author=snippet["authorDisplayName"],
                    like_count=snippet["likeCount"],
                    published_at=snippet["publishedAt"]
                )
            )
        
        return comments
    
    except googleapiclient.errors.HttpError as e:
        error_content = json.loads(e.content)
        error_message = error_content["error"]["message"]
        raise HTTPException(status_code=e.resp.status, detail=error_message)
    
    except Exception as e:
        logger.error(f"Error fetching comments: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching comments: {str(e)}")

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "model_loaded": sentiment_model is not None}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)