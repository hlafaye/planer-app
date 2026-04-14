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
    # NOTE: use string concat, NOT .format() — curly braces would be misinterpreted
    prompt = (
        "Tu es un assistant qui extrait les informations d'un devis commercial francais.\n\n"
        "ANATOMIE D'UN DEVIS:\n"
        "- L'EMETTEUR (= FOURNISSEUR): l'entreprise qui VEND, en haut du document avec ses coordonnees (SIRET, TVA, adresse). C'est elle qui emet le devis.\n"
        "- Le DESTINATAIRE (= CLIENT): l'entreprise qui RECOIT et paiera le devis. Identifiee par 'A:', 'Client:', 'Facturation:'.\n\n"
        "REGLES CRITIQUES:\n"
        "1. fournisseur_nom = EMETTEUR du devis (en-tete, avec SIRET) — JAMAIS le destinataire\n"
        "2. client_nom = DESTINATAIRE du devis (zone client/facturation) ou null\n"
        "3. nom = OBJET de la prestation (PAS un nom d'entreprise). Ex: 'Location linge mensuelle', 'Four mixte Rational'\n"
        "4. Si prestation = nettoyage/location/maintenance/service: type_devis_suggere = sous_traitant\n"
        "5. Si achat equipement/mobilier: type_devis_suggere = fournisseur\n"
        "6. Si TTC non explicite: calculer TTC = HT x (1 + taux/100)\n"
        "7. Dates au format YYYY-MM-DD\n\n"
        "Retourne UNIQUEMENT un JSON valide avec ces champs:\n"
        "nom (string description courte de la prestation max 80 chars — PAS un nom d'entreprise), "
        "fournisseur_nom (string — l'EMETTEUR), client_nom (string ou null — le DESTINATAIRE), "
        "numero_devis (string ou null), date_devis (YYYY-MM-DD ou null), "
        "montant_ht (number), tva_taux (number), tva_montant (number), montant_ttc (number), "
        "date_livraison_prevue (YYYY-MM-DD ou null), "
        "categorie (gros_materiel|petit_materiel|mobilier|it|signaletique|agencement|services|autre), "
        "type_devis_suggere (fournisseur|sous_traitant|personnel|client), "
        "description (string 2-3 phrases).\n\n"
        "Texte OCR du devis:\n---\n" + text[:4500] + "\n---\n\nJSON:"
    )

    try:
        response = requests.post(
            "{}/api/generate".format(OLLAMA_URL),
            json={
                "model": "llama3.1:8b",
                "prompt": prompt,
                "stream": False,
                "format": "json",
                "options": {"temperature": 0.1, "num_predict": 1500},
            },
            timeout=120,
        )
        response.raise_for_status()
        data = response.json()
        raw_response = data.get("response", "")

        # Try to parse JSON, with cleanup for common issues
        try:
            extracted = json.loads(raw_response)
        except json.JSONDecodeError:
            # Try to fix truncated JSON by closing open strings/objects
            cleaned = raw_response.strip()
            if not cleaned.endswith("}"):
                cleaned += '"}'
            try:
                extracted = json.loads(cleaned)
            except json.JSONDecodeError:
                # Last resort: extract what we can with regex
                import re
                extracted = {}
                for field in ["nom", "fournisseur_nom", "montant_ht", "tva_taux", "montant_ttc", "date_devis", "categorie", "description"]:
                    match = re.search(r'"' + field + r'":\s*"?([^",}]+)"?', raw_response)
                    if match:
                        val = match.group(1).strip()
                        if field in ("montant_ht", "tva_taux", "montant_ttc", "tva_montant"):
                            try:
                                extracted[field] = float(val)
                            except ValueError:
                                pass
                        else:
                            extracted[field] = val

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
