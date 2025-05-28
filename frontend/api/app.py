from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from openai import OpenAI

app = FastAPI()

@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        client = OpenAI(api_key=request.api_key)
        
        async def generate():
            stream = client.chat.completions.create(
                model=request.model,
                messages=[
                    {"role": "developer", "content": request.developer_message},
                    {"role": "user", "content": request.user_message}
                ],
                stream=True
            )
            
            current_chunk = ""
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    content = chunk.choices[0].delta.content
                    current_chunk += content
                    
                    # Only yield when we have a complete word or punctuation
                    if content.isspace() or content in '.,!?':
                        yield current_chunk
                        current_chunk = ""
            
            # Yield any remaining content
            if current_chunk:
                yield current_chunk

        return StreamingResponse(generate(), media_type="text/plain")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 