"""
LLM-powered document verification service.
Uses OpenAI GPT-4 Vision or similar to analyze verification documents.
"""
import os
import base64
import httpx
from typing import Dict, Optional
from app.core.config import settings
import logging

# Import settings to access OPENAI_API_KEY
from app.core.config import settings as app_settings

logger = logging.getLogger(__name__)


async def verify_document_with_llm(
    file_url: str,
    document_type: str,
    user_name: str,
    user_email: str
) -> Dict[str, any]:
    """
    Verify a document using LLM (OpenAI GPT-4 Vision).
    
    Returns:
        {
            "verified": bool,
            "confidence": float (0-1),
            "issues": list[str],
            "recommendation": "APPROVE" | "REJECT" | "REQUEST_MORE_DETAILS",
            "reasoning": str,
            "extracted_info": dict
        }
    """
    # Check if OpenAI API key is configured
    # Try multiple sources: settings, environment variable, and .env file
    openai_api_key = (
        app_settings.OPENAI_API_KEY or 
        os.getenv("OPENAI_API_KEY") or 
        os.getenv("OPENAI_KEY")
    )
    
    # Log for debugging
    logger.info(f"Checking OpenAI API key: settings.OPENAI_API_KEY={'SET' if app_settings.OPENAI_API_KEY else 'NOT SET'}, "
                f"env OPENAI_API_KEY={'SET' if os.getenv('OPENAI_API_KEY') else 'NOT SET'}")
    
    if not openai_api_key or openai_api_key.strip() == "":
        logger.warning("OPENAI_API_KEY not configured. Skipping LLM verification.")
        logger.warning(f"Settings value: '{app_settings.OPENAI_API_KEY}', Env value: '{os.getenv('OPENAI_API_KEY')}'")
        return {
            "verified": False,
            "confidence": 0.0,
            "issues": ["LLM verification not configured - OpenAI API key not found"],
            "recommendation": "REQUEST_MORE_DETAILS",
            "reasoning": "LLM verification service is not available. Please set OPENAI_API_KEY in your .env file or environment variables. Manual review required.",
            "extracted_info": {}
        }
    
    try:
        # Download the image/document
        async with httpx.AsyncClient() as client:
            response = await client.get(file_url, timeout=30.0)
            response.raise_for_status()
            image_data = response.content
        
        # Encode image to base64
        base64_image = base64.b64encode(image_data).decode('utf-8')
        
        # Determine MIME type
        mime_type = "image/jpeg"
        if file_url.endswith('.png'):
            mime_type = "image/png"
        elif file_url.endswith('.pdf'):
            mime_type = "application/pdf"
        
        # Prepare prompt based on document type
        if document_type == "NATIONAL_ID":
            prompt = f"""Analyze this national ID document for user {user_name} ({user_email}).

Please verify:
1. Is this a valid national ID document?
2. Is the document clear and readable?
3. Does the name match the user's account name?
4. Is the document not expired?
5. Are there any signs of tampering or forgery?

Provide your analysis in the following format:
- verified: true/false
- confidence: 0.0-1.0
- issues: list of any issues found
- recommendation: APPROVE, REJECT, or REQUEST_MORE_DETAILS
- reasoning: detailed explanation
- extracted_info: name, ID number, expiry date if visible"""
        else:  # CONTRACT
            prompt = f"""Analyze this residency/ownership contract document for user {user_name} ({user_email}).

Please verify:
1. Is this a valid contract or proof of residency document?
2. Is the document clear and readable?
3. Does the name/address match the user's account?
4. Is the document dated and signed?
5. Is it related to the compound/neighborhood they selected?
6. Are there any signs of tampering or forgery?

Provide your analysis in the following format:
- verified: true/false
- confidence: 0.0-1.0
- issues: list of any issues found
- recommendation: APPROVE, REJECT, or REQUEST_MORE_DETAILS
- reasoning: detailed explanation
- extracted_info: property address, contract date, parties involved if visible"""
        
        # Call OpenAI GPT-4 Vision API
        async with httpx.AsyncClient() as client:
            api_response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {openai_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4-vision-preview",
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": prompt
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:{mime_type};base64,{base64_image}"
                                    }
                                }
                            ]
                        }
                    ],
                    "max_tokens": 1000
                },
                timeout=60.0
            )
            api_response.raise_for_status()
            result = api_response.json()
        
        # Parse LLM response
        content = result["choices"][0]["message"]["content"]
        
        # Try to extract structured data from LLM response
        # The LLM should return JSON-like structure
        import json
        import re
        
        # Try to find JSON in the response
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            try:
                parsed = json.loads(json_match.group())
                return {
                    "verified": parsed.get("verified", False),
                    "confidence": float(parsed.get("confidence", 0.0)),
                    "issues": parsed.get("issues", []),
                    "recommendation": parsed.get("recommendation", "REQUEST_MORE_DETAILS"),
                    "reasoning": parsed.get("reasoning", content),
                    "extracted_info": parsed.get("extracted_info", {})
                }
            except json.JSONDecodeError:
                pass
        
        # Fallback: parse text response
        verified = "verified" in content.lower() and "true" in content.lower()
        confidence = 0.7 if verified else 0.3
        
        if "approve" in content.lower():
            recommendation = "APPROVE"
        elif "reject" in content.lower():
            recommendation = "REJECT"
        else:
            recommendation = "REQUEST_MORE_DETAILS"
        
        return {
            "verified": verified,
            "confidence": confidence,
            "issues": [],
            "recommendation": recommendation,
            "reasoning": content,
            "extracted_info": {}
        }
        
    except Exception as e:
        logger.error(f"LLM verification failed: {e}")
        return {
            "verified": False,
            "confidence": 0.0,
            "issues": [f"LLM verification error: {str(e)}"],
            "recommendation": "REQUEST_MORE_DETAILS",
            "reasoning": f"Failed to verify document: {str(e)}",
            "extracted_info": {}
        }

