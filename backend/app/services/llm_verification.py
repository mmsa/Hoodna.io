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
from io import BytesIO

# Import settings to access OPENAI_API_KEY
from app.core.config import settings as app_settings

logger = logging.getLogger(__name__)

# Try to import PyMuPDF for PDF conversion
try:
    import fitz  # PyMuPDF
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False
    logger.warning("PyMuPDF not installed. PDF conversion will not be available.")


async def verify_document_with_llm(
    file_url: str,
    document_type: str,
    user_name: str,
    user_email: str,
    compound_name: str = None
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
        # Check if file exists (for local storage)
        if file_url.startswith('/api/uploads/'):
            from app.services.storage import get_local_file_path, use_local_storage
            if use_local_storage():
                local_path = get_local_file_path(file_url)
                if local_path and not local_path.exists():
                    logger.warning(f"File not found at local path: {local_path}")
                    return {
                        "verified": False,
                        "confidence": 0.0,
                        "issues": [f"File not found: The document file is missing. This may have occurred due to an upload error. Please ask the user to re-upload the document."],
                        "recommendation": "REQUEST_MORE_DETAILS",
                        "reasoning": f"The document file could not be found at the expected location. The file URL is: {file_url}. This typically happens when a file was uploaded before a system update or if the upload process failed. Please request the user to re-upload the document.",
                        "extracted_info": {}
                    }
        
        # Ensure file_url is absolute
        if file_url.startswith('/api/uploads/'):
            # Local storage - make absolute URL
            base_url = settings.FRONTEND_URL.replace(':3000', ':8000')  # Backend URL
            if not file_url.startswith('http'):
                file_url = f"{base_url}{file_url}"
        
        # Download the image/document
        async with httpx.AsyncClient() as client:
            response = await client.get(file_url, timeout=30.0)
            if response.status_code == 404:
                logger.warning(f"File not found at URL: {file_url}")
                return {
                    "verified": False,
                    "confidence": 0.0,
                    "issues": [f"File not found: The document file is missing (404 Not Found). This may have occurred due to an upload error. Please ask the user to re-upload the document."],
                    "recommendation": "REQUEST_MORE_DETAILS",
                    "reasoning": f"The document file could not be found at the URL: {file_url}. This typically happens when a file was uploaded before a system update or if the upload process failed. Please request the user to re-upload the document.",
                    "extracted_info": {}
                }
            response.raise_for_status()
            file_data = response.content
        
        # Determine file type and handle PDFs
        is_pdf = file_url.lower().endswith('.pdf')
        mime_type = "image/jpeg"
        
        if is_pdf:
            # Convert PDF to image
            if not PDF_SUPPORT:
                logger.error("PDF conversion not available - PyMuPDF not installed.")
                return {
                    "verified": False,
                    "confidence": 0.0,
                    "issues": ["PDF conversion library not installed. Please install PyMuPDF or convert PDF to image manually."],
                    "recommendation": "REQUEST_MORE_DETAILS",
                    "reasoning": "PDF conversion is not available. Please install PyMuPDF library or convert the PDF to an image format (JPEG/PNG) manually.",
                    "extracted_info": {}
                }
            
            try:
                # Open PDF from bytes - PyMuPDF can open directly from bytes
                # Using memoryview for better performance with large files
                pdf_document = fitz.open(stream=file_data, filetype="pdf")
                page_count = len(pdf_document)
                
                if page_count == 0:
                    pdf_document.close()
                    raise Exception("PDF has no pages")
                
                # Get first page (most documents have important info on first page)
                page = pdf_document[0]
                
                # Convert page to image (PNG format, 300 DPI for good quality)
                # Matrix for scaling: 2.0 = 2x zoom (higher quality)
                mat = fitz.Matrix(2.0, 2.0)  # 2x zoom = ~300 DPI
                pix = page.get_pixmap(matrix=mat)
                
                # Convert to PNG bytes - this creates a copy of the data
                # Extract the bytes data immediately
                image_data = pix.tobytes("png")
                
                # Clean up resources in order
                pix = None  # Free pixmap memory
                page = None  # Release page reference
                
                # Close document (this should be safe now that we have image_data)
                pdf_document.close()
                pdf_document = None
                
                mime_type = "image/png"
                logger.info(f"Successfully converted PDF to image (page 1 of {page_count} pages)")
                
            except Exception as pdf_error:
                logger.error(f"Failed to convert PDF to image: {pdf_error}")
                return {
                    "verified": False,
                    "confidence": 0.0,
                    "issues": [f"Failed to convert PDF to image: {str(pdf_error)}"],
                    "recommendation": "REQUEST_MORE_DETAILS",
                    "reasoning": f"Could not convert PDF document to image format. Error: {str(pdf_error)}. Please try converting the PDF to an image manually or use manual review.",
                    "extracted_info": {}
                }
        else:
            # Regular image file
            image_data = file_data
            if file_url.lower().endswith('.png'):
                mime_type = "image/png"
            elif file_url.lower().endswith('.webp'):
                mime_type = "image/webp"
            elif file_url.lower().endswith('.gif'):
                mime_type = "image/gif"
        
        # Encode image to base64
        base64_image = base64.b64encode(image_data).decode('utf-8')
        
        # Prepare prompt based on document type
        compound_context = f" in the compound '{compound_name}'" if compound_name else ""
        
        # Service Provider document types
        if document_type == "COMMERCIAL_REGISTER":
            prompt = f"""CRITICAL: This document was submitted as a COMMERCIAL_REGISTER (سجل تجاري). You MUST verify it is actually a Commercial Register document, NOT a National ID, contract, or other document type.

Analyze this Commercial Register document (may be in Arabic or English) for service provider "{user_name}" (email: {user_email}){compound_context}.

IMPORTANT: 
- The document may be in Arabic. You MUST read and understand Arabic text if present.
- DOCUMENT TYPE CHECK: First verify this is actually a Commercial Register (سجل تجاري), NOT a National ID, contract, or other document.
  - If this is NOT a Commercial Register, mark verified=false, recommendation=REJECT, and add issue "Wrong document type - expected Commercial Register but received [actual type]"
- Commercial Register should contain business registration number, business name, registration date, business activity, and official stamps/seals.

Please analyze and verify:
1. DOCUMENT TYPE: Is this actually a Commercial Register document (سجل تجاري)?
   - REJECT if it's a National ID, contract, or any other document type
   - Only proceed if it's clearly a Commercial Register
2. Is this a valid, authentic Commercial Register document?
3. Is the document clear, readable, and not tampered with?
4. Does the business name on the Commercial Register match or closely match the service provider's business name?
5. Is the document current and not expired?
6. Are there any signs of forgery, tampering, or manipulation?
7. Does the business activity/description match the service category being provided?

Respond in JSON format ONLY:
{{
  "verified": true/false,
  "confidence": 0.0-1.0,
  "issues": ["list", "of", "issues"],
  "recommendation": "APPROVE" or "REJECT" or "REQUEST_MORE_DETAILS",
  "reasoning": "detailed explanation including document type verification and business name matching",
  "extracted_info": {{"business_name": "...", "registration_number": "...", "registration_date": "...", "business_activity": "...", "document_type_confirmed": "COMMERCIAL_REGISTER" or "OTHER"}}
}}"""
        elif document_type == "TAX_CARD":
            prompt = f"""CRITICAL: This document was submitted as a TAX_CARD (بطاقة ضريبية). You MUST verify it is actually a Tax Card document, NOT a National ID, Commercial Register, or other document type.

Analyze this Tax Card document (may be in Arabic or English) for service provider "{user_name}" (email: {user_email}){compound_context}.

IMPORTANT: 
- The document may be in Arabic. You MUST read and understand Arabic text if present.
- DOCUMENT TYPE CHECK: First verify this is actually a Tax Card (بطاقة ضريبية), NOT a National ID, Commercial Register, or other document.
  - If this is NOT a Tax Card, mark verified=false, recommendation=REJECT, and add issue "Wrong document type - expected Tax Card but received [actual type]"
- Tax Card should contain tax identification number, business name, and tax authority information.

Please analyze and verify:
1. DOCUMENT TYPE: Is this actually a Tax Card document (بطاقة ضريبية)?
   - REJECT if it's a National ID, Commercial Register, or any other document type
   - Only proceed if it's clearly a Tax Card
2. Is this a valid, authentic Tax Card document?
3. Is the document clear, readable, and not tampered with?
4. Does the business name on the Tax Card match or closely match the service provider's business name?
5. Is the document current and not expired?
6. Are there any signs of forgery, tampering, or manipulation?

Respond in JSON format ONLY:
{{
  "verified": true/false,
  "confidence": 0.0-1.0,
  "issues": ["list", "of", "issues"],
  "recommendation": "APPROVE" or "REJECT" or "REQUEST_MORE_DETAILS",
  "reasoning": "detailed explanation including document type verification and business name matching",
  "extracted_info": {{"business_name": "...", "tax_number": "...", "document_type_confirmed": "TAX_CARD" or "OTHER"}}
}}"""
        elif document_type == "NATIONAL_ID_FRONT":
            prompt = f"""CRITICAL: This document was submitted as a NATIONAL_ID_FRONT (front side of National ID / بطاقة شخصية - الوجه). You MUST verify it is actually the front side of a National ID document, NOT a contract, Commercial Register, or other document type.

Analyze this National ID front side document (may be in Arabic or English) for service provider "{user_name}" (email: {user_email}){compound_context}.

IMPORTANT: 
- The document may be in Arabic. You MUST read and understand Arabic text if present.
- DOCUMENT TYPE CHECK: First verify this is actually the front side of a National ID (بطاقة شخصية - الوجه), NOT a contract, Commercial Register, or other document.
  - If this is NOT a National ID front, mark verified=false, recommendation=REJECT, and add issue "Wrong document type - expected National ID Front but received [actual type]"
- National ID front should contain: photo, name, ID number, date of birth, and other personal information.

Please analyze and verify:
1. DOCUMENT TYPE: Is this actually the front side of a National ID document (بطاقة شخصية - الوجه)?
   - REJECT if it's a contract, Commercial Register, or any other document type
   - Only proceed if it's clearly a National ID front
2. Is this a valid, authentic National ID front document?
3. Is the document clear, readable, and not tampered with?
4. Name Matching: Does the name on the ID match or closely match "{user_name}"?
   - Consider: Arabic/English variations, transliterations, nicknames, middle names, name order differences
5. Is the document current and not expired?
6. Are there any signs of forgery, tampering, or manipulation?

Respond in JSON format ONLY:
{{
  "verified": true/false,
  "confidence": 0.0-1.0,
  "name_match": "MATCH" or "NO_MATCH" or "UNCLEAR",
  "issues": ["list", "of", "issues"],
  "recommendation": "APPROVE" or "REJECT" or "REQUEST_MORE_DETAILS",
  "reasoning": "detailed explanation including document type verification and name comparison",
  "extracted_info": {{"name": "...", "id_number": "...", "date_of_birth": "...", "document_type_confirmed": "NATIONAL_ID_FRONT" or "OTHER"}}
}}"""
        elif document_type == "NATIONAL_ID_BACK":
            prompt = f"""CRITICAL: This document was submitted as a NATIONAL_ID_BACK (back side of National ID / بطاقة شخصية - الخلف). You MUST verify it is actually the back side of a National ID document, NOT a contract, Commercial Register, or other document type.

Analyze this National ID back side document (may be in Arabic or English) for service provider "{user_name}" (email: {user_email}){compound_context}.

IMPORTANT: 
- The document may be in Arabic. You MUST read and understand Arabic text if present.
- DOCUMENT TYPE CHECK: First verify this is actually the back side of a National ID (بطاقة شخصية - الخلف), NOT a contract, Commercial Register, or other document.
  - If this is NOT a National ID back, mark verified=false, recommendation=REJECT, and add issue "Wrong document type - expected National ID Back but received [actual type]"
- National ID back should contain: address, occupation, and other personal details.

Please analyze and verify:
1. DOCUMENT TYPE: Is this actually the back side of a National ID document (بطاقة شخصية - الخلف)?
   - REJECT if it's a contract, Commercial Register, or any other document type
   - Only proceed if it's clearly a National ID back
2. Is this a valid, authentic National ID back document?
3. Is the document clear, readable, and not tampered with?
4. Does the occupation on the ID match or relate to the service being provided?
5. COMPOUND NAME IN ADDRESS: Does the address mention the compound name "{compound_name}"?
   - Check if "{compound_name}" appears anywhere in the address field (may be in Arabic or English)
6. Are there any signs of forgery, tampering, or manipulation?

Respond in JSON format ONLY:
{{
  "verified": true/false,
  "confidence": 0.0-1.0,
  "address_match": "MATCH" or "NO_MATCH" or "UNCLEAR" or "N/A",
  "issues": ["list", "of", "issues"],
  "recommendation": "APPROVE" or "REJECT" or "REQUEST_MORE_DETAILS",
  "reasoning": "detailed explanation including document type verification, occupation check, and whether compound name was found in address",
  "extracted_info": {{"address": "...", "occupation": "...", "compound_name_in_address": true/false, "document_type_confirmed": "NATIONAL_ID_BACK" or "OTHER"}}
}}"""
        elif document_type == "AUTHORIZATION_LETTER":
            prompt = f"""CRITICAL: This document was submitted as an AUTHORIZATION_LETTER (letter of authorization / خطاب تفويض). You MUST verify it is actually an authorization letter, NOT a National ID, contract, or other document type.

Analyze this Authorization Letter document (may be in Arabic or English) for compound moderator "{user_name}" (email: {user_email}){compound_context}.

IMPORTANT: 
- The document may be in Arabic. You MUST read and understand Arabic text if present.
- DOCUMENT TYPE CHECK: First verify this is actually an Authorization Letter (خطاب تفويض), NOT a National ID, contract, or other document.
  - If this is NOT an Authorization Letter, mark verified=false, recommendation=REJECT, and add issue "Wrong document type - expected Authorization Letter but received [actual type]"
- Authorization Letter should: be on official letterhead, mention the compound name "{compound_name}", authorize the person to moderate/manage the compound, include dates, signatures, and official stamps.

Please analyze and verify:
1. DOCUMENT TYPE: Is this actually an Authorization Letter (خطاب تفويض)?
   - REJECT if it's a National ID, contract, or any other document type
   - Only proceed if it's clearly an Authorization Letter
2. Is this a valid, authentic Authorization Letter?
3. Is the document clear, readable, and not tampered with?
4. Name Matching: Does the authorized person's name match or closely match "{user_name}"?
5. COMPOUND NAME: Does the letter mention the compound name "{compound_name}"?
   - This is REQUIRED - the authorization must be for the specific compound
6. Does the letter authorize the person to moderate/manage the compound?
7. Is the document properly dated and signed?
8. Are there any signs of forgery, tampering, or manipulation?

Respond in JSON format ONLY:
{{
  "verified": true/false,
  "confidence": 0.0-1.0,
  "name_match": "MATCH" or "NO_MATCH" or "UNCLEAR",
  "compound_name_match": "MATCH" or "NO_MATCH" or "UNCLEAR",
  "issues": ["list", "of", "issues"],
  "recommendation": "APPROVE" or "REJECT" or "REQUEST_MORE_DETAILS",
  "reasoning": "detailed explanation including document type verification, name matching, and whether compound name was found",
  "extracted_info": {{"authorized_name": "...", "compound_name": "...", "authorization_date": "...", "document_type_confirmed": "AUTHORIZATION_LETTER" or "OTHER"}}
}}"""
        elif document_type == "NATIONAL_ID":
            prompt = f"""CRITICAL: This document was submitted as a NATIONAL ID. You MUST verify it is actually a National ID document, NOT a contract or other document type.

Analyze this document (may be in Arabic or English) for user "{user_name}" (email: {user_email}){compound_context}.

IMPORTANT: 
- The document may be in Arabic. You MUST read and understand Arabic text if present.
- DOCUMENT TYPE CHECK: First verify this is actually a National ID (بطاقة شخصية / ID card), NOT a contract, lease, or other document.
  - If this is NOT a National ID, mark verified=false, recommendation=REJECT, and add issue "Wrong document type - expected National ID but received [actual type]"
- Names do NOT need to be 100% identical - they should be "close enough" to be the same person.
- COMPOUND NAME CHECK: If the National ID address mentions the compound name "{compound_name}", then this document alone is sufficient for verification (no contract needed).

Please analyze and verify:
1. DOCUMENT TYPE: Is this actually a National ID document (بطاقة شخصية)?
   - REJECT if it's a contract, lease, or any other document type
   - Only proceed if it's clearly a National ID/ID card
2. Is this a valid, authentic National ID document?
3. Is the document clear, readable, and not tampered with?
4. Name Matching: Does the name on the ID match or closely match "{user_name}"?
   - Consider: Arabic/English variations, transliterations, nicknames, middle names, name order differences
   - Examples: "Mohamed" vs "Mohammed" vs "محمد" = MATCH
   - "Ahmed Ali" vs "Ahmed Mohamed Ali" = MATCH (if one contains the other)
   - "محمد علي" vs "Mohamed Ali" = MATCH (same name, different scripts)
   - "Mohamed Mostafa" vs "Mohamed M. Mostafa" = MATCH (middle initial)
   - Only mark NO_MATCH if names are clearly different people (e.g., "Ahmed" vs "Sara")
   - Mark MATCH if names are reasonably similar (same person, different spelling/translation)
5. COMPOUND NAME IN ADDRESS: Does the address on the National ID mention the compound name "{compound_name}"?
   - Check if "{compound_name}" appears anywhere in the address field (may be in Arabic or English)
   - Check if the area/district matches or relates to the compound location
   - MATCH if compound name is mentioned anywhere in the address (even if address format differs)
   - MATCH if area/district clearly relates to the compound location
   - NO_MATCH only if address clearly refers to a completely different location/compound
   - Be flexible - compound name might appear in Arabic or English, or in different formats
   - If MATCH: This National ID alone is sufficient for verification (no contract needed)
   - If NO_MATCH: User will need to also submit a contract with compound name
6. Is the document current and not expired?
7. Are there any signs of forgery, tampering, or manipulation?

Respond in JSON format ONLY:
{{
  "verified": true/false,
  "confidence": 0.0-1.0,
  "name_match": "MATCH" or "NO_MATCH" or "UNCLEAR",
  "address_match": "MATCH" or "NO_MATCH" or "UNCLEAR" or "N/A",
  "issues": ["list", "of", "issues"],
  "recommendation": "APPROVE" or "REJECT" or "REQUEST_MORE_DETAILS",
  "reasoning": "detailed explanation including document type verification, name comparison, and whether compound name was found in address",
  "extracted_info": {{"name": "...", "id_number": "...", "expiry_date": "...", "address": "...", "compound_name_in_address": true/false, "document_type_confirmed": "NATIONAL_ID" or "CONTRACT" or "OTHER"}}
}}"""
        else:  # CONTRACT
            prompt = f"""CRITICAL FIRST STEP - DOCUMENT TYPE VERIFICATION:
This document was submitted as a CONTRACT/PROOF OF RESIDENCY/LEASE AGREEMENT. 
You MUST FIRST verify the document type before proceeding with any other checks.

STEP 1 - DOCUMENT TYPE IDENTIFICATION (MANDATORY):
Look at the document carefully and identify what type of document it actually is:
- CONTRACT: Should contain words like "عقد إيجار" (lease contract), "عقد تمليك" (ownership contract), "Contract", "Lease Agreement", "Rental Agreement", property details, terms, dates, signatures
- NATIONAL ID: Should contain "بطاقة شخصية", "ID Card", personal photo, ID number, personal information in card format
- OTHER: Any other document type

CRITICAL RULES:
- If the document is a NATIONAL ID (بطاقة شخصية / ID card), you MUST:
  * Set verified=false
  * Set recommendation=REJECT
  * Set document_type_confirmed="NATIONAL_ID"
  * Add issue: "Wrong document type - expected Contract/Proof of Residency but received National ID"
  * STOP HERE - do not proceed with name/address matching
  
- If the document is NOT a contract/lease/proof of residency, you MUST:
  * Set verified=false
  * Set recommendation=REJECT
  * Set document_type_confirmed="OTHER"
  * Add issue: "Wrong document type - expected Contract/Proof of Residency but received [actual type]"
  * STOP HERE - do not proceed with name/address matching

- ONLY if document_type_confirmed="CONTRACT" should you proceed to name and address matching below.

STEP 2 - CONTRACT VERIFICATION (only if document type is CONTRACT):
Analyze this contract document (may be in Arabic or English) for user "{user_name}" (email: {user_email}){compound_context}.

IMPORTANT: 
- The document may be in Arabic. You MUST read and understand Arabic text if present.
- Names do NOT need to be 100% identical - they should be "close enough" to be the same person.
- Address matching: The address MUST mention the compound name "{compound_name}" somewhere in the document.
- If this contract is approved (name matches + compound name found), it alone is sufficient for verification.

Please analyze and verify:
1. Is this a valid contract, lease agreement, or proof of residency document?
2. Is the document clear, readable, and not tampered with?
3. Name Matching: Does the name on the document match or closely match "{user_name}"?
   - Consider: Arabic/English variations, transliterations, nicknames, middle names, name order differences
   - Examples: "Mohamed" vs "Mohammed" vs "محمد" = MATCH
   - "Ahmed Ali" vs "Ahmed Mohamed Ali" = MATCH (if one contains the other)
   - "محمد علي" vs "Mohamed Ali" = MATCH (same name, different scripts)
   - "Mohamed Mostafa" vs "Mohamed M. Mostafa" = MATCH (middle initial)
   - Only mark NO_MATCH if names are clearly different people (e.g., "Ahmed" vs "Sara")
   - Mark MATCH if names are reasonably similar (same person, different spelling/translation)
4. Address/Compound Matching: Does the address or property location mention "{compound_name}"?
   - Check if the compound name "{compound_name}" appears anywhere in the address/property description
   - Check if the area/district matches or relates to the compound location
   - MATCH if compound name is mentioned anywhere in the document (even if address format differs)
   - MATCH if area/district clearly relates to the compound location
   - NO_MATCH only if address clearly refers to a completely different location/compound
   - Be flexible - compound name might appear in Arabic or English, or in different formats
   - This is REQUIRED - contract must mention compound name to be valid
5. Is the document properly dated and signed?
6. Are there any signs of forgery, tampering, or manipulation?

Respond in JSON format ONLY:
{{
  "verified": true/false,
  "confidence": 0.0-1.0,
  "name_match": "MATCH" or "NO_MATCH" or "UNCLEAR",
  "address_match": "MATCH" or "NO_MATCH" or "UNCLEAR",
  "issues": ["list", "of", "issues"],
  "recommendation": "APPROVE" or "REJECT" or "REQUEST_MORE_DETAILS",
  "reasoning": "detailed explanation. FIRST state the document type you identified (CONTRACT, NATIONAL_ID, or OTHER). Then explain name and address comparison, mentioning if compound name was found. If document type is wrong, explain why it's wrong.",
  "extracted_info": {{
    "property_address": "...",
    "contract_date": "...",
    "parties": "...",
    "compound_name_in_address": true/false,
    "document_type_confirmed": "CONTRACT" or "NATIONAL_ID" or "OTHER"
  }}
}}

REMEMBER: document_type_confirmed MUST be set correctly. If it's "NATIONAL_ID" or "OTHER", set verified=false and recommendation=REJECT."""
        
        # Call OpenAI GPT-4 Vision API
        async with httpx.AsyncClient() as client:
            api_response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {openai_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4o",
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
                                        "url": f"data:{mime_type};base64,{base64_image}",
                                        "detail": "high"
                                    }
                                }
                            ]
                        }
                    ],
                    "max_tokens": 1000
                },
                timeout=60.0
            )
            # Check response status and handle errors
            if api_response.status_code != 200:
                error_text = api_response.text
                try:
                    error_json = api_response.json()
                    error_message = error_json.get("error", {}).get("message", error_text)
                    error_type = error_json.get("error", {}).get("type", "unknown")
                    logger.error(f"OpenAI API error {api_response.status_code} ({error_type}): {error_message}")
                    raise Exception(f"OpenAI API error: {error_message}")
                except:
                    logger.error(f"OpenAI API error {api_response.status_code}: {error_text}")
                    raise Exception(f"OpenAI API returned {api_response.status_code}: {error_text}")
            
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
                confidence = float(parsed.get("confidence", 0.0))
                name_match = parsed.get("name_match", "UNCLEAR")
                address_match = parsed.get("address_match", "UNCLEAR")
                
                # Auto-select recommendation based on confidence and matches
                recommendation = parsed.get("recommendation", "REQUEST_MORE_DETAILS")
                if confidence >= 0.8:
                    # High confidence - auto-select based on matches
                    if name_match == "MATCH" and (address_match == "MATCH" or address_match == "N/A"):
                        recommendation = "APPROVE"
                    elif name_match == "NO_MATCH" or address_match == "NO_MATCH":
                        recommendation = "REJECT"
                    else:
                        recommendation = "REQUEST_MORE_DETAILS"
                
                return {
                    "verified": parsed.get("verified", False),
                    "confidence": confidence,
                    "name_match": name_match,
                    "address_match": address_match,
                    "issues": parsed.get("issues", []),
                    "recommendation": recommendation,
                    "reasoning": parsed.get("reasoning", content),
                    "extracted_info": parsed.get("extracted_info", {})
                }
            except json.JSONDecodeError:
                pass
        
        # Fallback: parse text response
        verified = "verified" in content.lower() and "true" in content.lower()
        confidence = 0.7 if verified else 0.3
        
        # Try to extract name and address match from text
        name_match = "UNCLEAR"
        if "name" in content.lower() and "match" in content.lower():
            if "does not match" in content.lower() or "no match" in content.lower() or "mismatch" in content.lower():
                name_match = "NO_MATCH"
            elif "match" in content.lower():
                name_match = "MATCH"
        
        address_match = "UNCLEAR"
        if "address" in content.lower() or "property" in content.lower() or "location" in content.lower():
            if "does not match" in content.lower() or "no match" in content.lower() or "mismatch" in content.lower():
                address_match = "NO_MATCH"
            elif "match" in content.lower():
                address_match = "MATCH"
        
        if "approve" in content.lower():
            recommendation = "APPROVE"
        elif "reject" in content.lower():
            recommendation = "REJECT"
        else:
            recommendation = "REQUEST_MORE_DETAILS"
        
        # Auto-select recommendation if confidence is high
        if confidence >= 0.8:
            if name_match == "MATCH" and (address_match == "MATCH" or address_match == "UNCLEAR"):
                recommendation = "APPROVE"
            elif name_match == "NO_MATCH" or address_match == "NO_MATCH":
                recommendation = "REJECT"
        
        return {
            "verified": verified,
            "confidence": confidence,
            "name_match": name_match,
            "address_match": address_match,
            "issues": [],
            "recommendation": recommendation,
            "reasoning": content,
            "extracted_info": {}
        }
        
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            logger.warning(f"File not found during LLM verification: {file_url}")
            return {
                "verified": False,
                "confidence": 0.0,
                "issues": [f"File not found: The document file is missing (404 Not Found). This may have occurred due to an upload error. Please ask the user to re-upload the document."],
                "recommendation": "REQUEST_MORE_DETAILS",
                "reasoning": f"The document file could not be found at the URL: {file_url}. This typically happens when a file was uploaded before a system update or if the upload process failed. Please request the user to re-upload the document.",
                "extracted_info": {}
            }
        logger.error(f"HTTP error during LLM verification: {e}")
        return {
            "verified": False,
            "confidence": 0.0,
            "issues": [f"HTTP error ({e.response.status_code}): {str(e)}"],
            "recommendation": "REQUEST_MORE_DETAILS",
            "reasoning": f"Failed to fetch document for verification: HTTP {e.response.status_code} - {str(e)}",
            "extracted_info": {}
        }
    except httpx.RequestError as e:
        logger.error(f"Network error during LLM verification: {e}")
        return {
            "verified": False,
            "confidence": 0.0,
            "issues": [f"Network error: Could not connect to file server. {str(e)}"],
            "recommendation": "REQUEST_MORE_DETAILS",
            "reasoning": f"Failed to fetch document due to network error: {str(e)}",
            "extracted_info": {}
        }
    except Exception as e:
        logger.error(f"LLM verification failed: {e}", exc_info=True)
        return {
            "verified": False,
            "confidence": 0.0,
            "issues": [f"LLM verification error: {str(e)}"],
            "recommendation": "REQUEST_MORE_DETAILS",
            "reasoning": f"Failed to verify document: {str(e)}",
            "extracted_info": {}
        }

