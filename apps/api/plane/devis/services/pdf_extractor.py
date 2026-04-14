# Planer custom: PDF extraction — pdfplumber (fast) + Tesseract OCR (fallback) + Ollama AI
import json
import logging
import os
from io import BytesIO

import requests

logger = logging.getLogger("plane.devis.extractor")

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://ollama:11434")


def extract_text_from_pdf(pdf_bytes):
    """Extract text: pdfplumber first (fast, digital PDFs), Tesseract fallback (scanned)."""

    # 1. Try pdfplumber (instant for digital PDFs)
    try:
        import pdfplumber

        text = ""
        with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages[:3]:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"

        if text.strip() and len(text) > 50:
            logger.info("PDF text extracted via pdfplumber (%d chars)", len(text))
            return {"method": "pdfplumber", "text": text}
    except Exception as e:
        logger.warning("pdfplumber failed: %s", e)

    # 2. Fallback: Tesseract OCR (scanned PDFs)
    try:
        import pytesseract
        from pdf2image import convert_from_bytes

        images = convert_from_bytes(pdf_bytes, dpi=200, first_page=1, last_page=3)
        text = ""
        for img in images:
            text += pytesseract.image_to_string(img, lang="fra+eng") + "\n"

        if text.strip():
            logger.info("PDF text extracted via Tesseract (%d chars)", len(text))
            return {"method": "tesseract", "text": text}
    except Exception as e:
        logger.warning("Tesseract failed: %s", e)

    return {"method": "failed", "error": "Aucun texte extractible", "text": ""}


def extract_devis_from_pdf(pdf_bytes):
    """Full pipeline: text extraction -> Ollama AI structuring -> JSON."""

    # Step 1: extract text
    extraction = extract_text_from_pdf(pdf_bytes)
    text = extraction.get("text", "")

    if not text or len(text) < 30:
        return {
            "error": "Texte insuffisant extrait du PDF",
            "method": extraction.get("method"),
        }

    # Step 2: Ollama structured extraction
    prompt = (
        "Tu es un assistant qui extrait les informations d'un devis commercial francais.\n"
        "Retourne UNIQUEMENT un JSON valide selon ce schema exact:\n\n"
        "{\n"
        '  "nom": "string (description courte, max 80 chars)",\n'
        '  "fournisseur_nom": "string (nom de l\'entreprise emettrice)",\n'
        '  "numero_devis": "string (reference du devis) ou null",\n'
        '  "date_devis": "YYYY-MM-DD ou null",\n'
        '  "montant_ht": number,\n'
        '  "tva_taux": number (ex: 20.0),\n'
        '  "tva_montant": number,\n'
        '  "montant_ttc": number,\n'
        '  "date_livraison_prevue": "YYYY-MM-DD ou null",\n'
        '  "categorie": "gros_materiel|petit_materiel|mobilier|it|signaletique|agencement|services|autre",\n'
        '  "type_devis_suggere": "fournisseur|sous_traitant|personnel|client",\n'
        '  "description": "string (2-3 phrases descriptives)"\n'
        "}\n\n"
        "Regles:\n"
        "- Si TTC non explicite mais HT et taux TVA connus: calculer TTC = HT x (1 + taux/100)\n"
        "- Si categorie = location/nettoyage/maintenance: type_devis_suggere = sous_traitant\n"
        "- Si categorie = equipement/mobilier: type_devis_suggere = fournisseur\n"
        "- Dates au format YYYY-MM-DD strict\n\n"
        "Texte OCR du devis:\n---\n{}\n---\n\nJSON:".format(text[:4500])
    )

    try:
        response = requests.post(
            "{}/api/generate".format(OLLAMA_URL),
            json={
                "model": "llama3.1:8b",
                "prompt": prompt,
                "stream": False,
                "format": "json",
                "options": {"temperature": 0.1, "num_predict": 800},
            },
            timeout=90,
        )
        response.raise_for_status()
        data = response.json()
        extracted = json.loads(data["response"])
        logger.info("Devis extracted OK: %s (%s)", extracted.get("nom", "?"), extraction.get("method"))

        return {
            "success": True,
            "data": extracted,
            "method": extraction["method"],
        }
    except requests.Timeout:
        return {"error": "Timeout Ollama (> 90s)", "method": extraction.get("method")}
    except json.JSONDecodeError as e:
        raw = data.get("response", "")[:500] if "data" in dir() else ""
        return {"error": "Ollama JSON invalide: {}".format(e), "raw": raw}
    except Exception as e:
        logger.error("Ollama error: %s", e)
        return {"error": "Erreur Ollama: {}".format(e)}
