# Planer custom: PDF extraction for devis (Tesseract OCR + Ollama)
import json
import logging
import os

import requests

logger = logging.getLogger("plane.devis.extractor")

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://ollama:11434")


def extract_devis_from_pdf(pdf_bytes):
    """Extract devis fields from PDF via OCR + Ollama AI structuring."""
    try:
        import pytesseract
        from PIL import Image
        from pdf2image import convert_from_bytes
    except ImportError as e:
        return {"error": "Dependance manquante: {}".format(e)}

    # 1. Convert PDF to images
    try:
        images = convert_from_bytes(pdf_bytes, dpi=200)
    except Exception as e:
        return {"error": "PDF invalide: {}".format(e)}

    # 2. OCR all pages
    full_text = ""
    for img in images:
        full_text += pytesseract.image_to_string(img, lang="fra+eng") + "\n"

    if not full_text.strip():
        return {"error": "Aucun texte detecte dans le PDF"}

    # 3. Call Ollama for structured extraction
    prompt = (
        "Tu recois le texte OCR d'un devis commercial francais. "
        "Extrais les informations au format JSON strict:\n\n"
        "{\n"
        '  "nom": "description courte du devis (max 80 chars)",\n'
        '  "fournisseur_nom": "nom de l\'entreprise qui emet le devis",\n'
        '  "date_devis": "YYYY-MM-DD ou null",\n'
        '  "montant_ht": float,\n'
        '  "tva_taux": float (ex: 20.0),\n'
        '  "tva_montant": float,\n'
        '  "montant_ttc": float,\n'
        '  "date_livraison_prevue": "YYYY-MM-DD ou null",\n'
        '  "categorie": "gros_materiel|petit_materiel|mobilier|it|signaletique|agencement|services|autre",\n'
        '  "description": "description detaillee, 2-3 phrases max"\n'
        "}\n\n"
        "Reponds UNIQUEMENT avec le JSON valide.\n\n"
        "Texte OCR:\n---\n{}\n---".format(full_text[:5000])
    )

    try:
        response = requests.post(
            "{}/api/generate".format(OLLAMA_URL),
            json={
                "model": "llama3.1:8b",
                "prompt": prompt,
                "stream": False,
                "format": "json",
                "options": {"temperature": 0.1},
            },
            timeout=120,
        )
        response.raise_for_status()
        data = response.json()
        extracted = json.loads(data["response"])
        logger.info("PDF extraction OK: %s", extracted.get("nom", "?"))
        return {"success": True, "data": extracted, "raw_text": full_text[:2000]}
    except json.JSONDecodeError:
        return {
            "error": "IA n'a pas retourne du JSON valide",
            "raw_text": full_text[:2000],
            "raw_response": data.get("response", "")[:500] if "data" in dir() else "",
        }
    except Exception as e:
        logger.error("PDF extraction error: %s", e)
        return {"error": "Erreur IA: {}".format(e), "raw_text": full_text[:2000]}


def extract_devis_from_image(image_bytes):
    """Extract text from an image (JPG/PNG) via Tesseract."""
    try:
        import pytesseract
        from PIL import Image
        from io import BytesIO
    except ImportError as e:
        return {"error": "Dependance manquante: {}".format(e)}

    image = Image.open(BytesIO(image_bytes))
    text = pytesseract.image_to_string(image, lang="fra+eng")

    if not text.strip():
        return {"error": "Aucun texte detecte"}

    return {"success": True, "raw_text": text}
