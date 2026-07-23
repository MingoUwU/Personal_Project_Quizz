import argparse
import datetime as dt
import html
import json
import re
import uuid
from pathlib import Path

import pdfplumber


CAU = "C\u00e2u"
TITLE = "B\u1ed9 c\u00e2u h\u1ecfi tr\u1eafc nghi\u1ec7m m\u00f4n L\u1ecbch s\u1eed \u0110\u1ea3ng C\u1ed9ng s\u1ea3n Vi\u1ec7t Nam"


def normalize_pdf_text(pdf_path: Path) -> str:
    with pdfplumber.open(pdf_path) as pdf:
        text = "\n".join(page.extract_text(x_tolerance=1, y_tolerance=3) or "" for page in pdf.pages)

    lines = []
    for raw_line in text.splitlines():
        line = re.sub(r"\s+", " ", raw_line).strip()
        if not line or re.fullmatch(r"\d{1,3}", line):
            continue
        lines.append(line)

    text = "\n".join(lines).replace(TITLE, "")
    text = re.sub(r"\s*(" + CAU + r"\s+\d+\s*[:.])", r"\n\1", text, flags=re.I)
    text = re.sub(r"(?<!^)\s+([a-dA-D]\s*[.)]\s+)", r"\n\1", text)
    text = re.sub(r"\s*(ANSWER\s*:\s*[A-Z])", r"\n\1", text, flags=re.I)
    return text


def is_question_start(line: str) -> bool:
    if re.match(r"^" + CAU + r"\s+\d+\s*[:.]", line, re.I):
        return True
    return bool(re.match(r"^\d{1,3}\.\s+\S+", line) and len(line) > 25)


def parse_option(line: str):
    return re.match(r"^([A-Z]{1,2}|[a-d])\s*[.)]\s*(.+)$", line)


def detect_answer(options):
    x_marked = []
    dotted = []

    for index, option in enumerate(options):
        text = option["text"]
        if re.search(r"(?:^|\s)[Xx]\s*$", text):
            x_marked.append(index)
            option["text"] = re.sub(r"(?:^|\s)[Xx]\s*$", "", text).strip()

        if option["text"].rstrip().endswith("."):
            dotted.append(index)

    if len(x_marked) == 1:
        index = x_marked[0]
        return {
            "label": options[index]["label"],
            "sourceLabel": options[index]["sourceLabel"],
            "text": options[index]["text"].rstrip(".").strip(),
            "confidence": "marked-x",
        }

    if len(dotted) == 1:
        index = dotted[0]
        return {
            "label": options[index]["label"],
            "sourceLabel": options[index]["sourceLabel"],
            "text": options[index]["text"].rstrip(".").strip(),
            "confidence": "single-dot",
        }

    return None


def parse_questions(text: str):
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines() if line.strip()]
    blocks = []
    current = []

    for line in lines:
        if is_question_start(line) and current:
            blocks.append(current)
            current = [line]
        else:
            current.append(line)

    if current:
        blocks.append(current)

    questions = []
    for block in blocks:
        question_lines = []
        options = []
        current_option = None

        for line in block:
            option_match = parse_option(line)
            if option_match:
                if current_option:
                    options.append(current_option)
                current_option = {
                    "sourceLabel": option_match.group(1).strip(),
                    "text": option_match.group(2).strip(),
                }
            elif current_option:
                current_option["text"] += " " + line
            else:
                question_lines.append(line)

        if current_option:
            options.append(current_option)

        if len(options) < 2 or not question_lines:
            continue

        first_line = question_lines[0]
        number = None
        cau_match = re.match(r"^" + CAU + r"\s+(\d+)\s*[:.]\s*(.*)$", first_line, re.I)
        if cau_match:
            number = int(cau_match.group(1))
            question_lines[0] = cau_match.group(2).strip()
        else:
            numbered_match = re.match(r"^(\d{1,3})\.\s*(.*)$", first_line)
            if numbered_match:
                number = int(numbered_match.group(1))
                question_lines[0] = numbered_match.group(2).strip()

        question = " ".join(line for line in question_lines if line).strip()
        question = re.sub(r"^ANSWER\s*:\s*[A-Z]\s*", "", question, flags=re.I).strip()
        if not question:
            continue

        normalized_options = []
        for index, option in enumerate(options[:6]):
            normalized_options.append(
                {
                    "sourceLabel": option["sourceLabel"],
                    "label": "abcdef"[index],
                    "text": option["text"].strip(),
                }
            )

        questions.append(
            {
                "number": number,
                "question": question,
                "options": normalized_options,
                "answer": detect_answer(normalized_options),
            }
        )

    return questions


def dedupe_questions(questions):
    seen = set()
    deduped = []

    for question in questions:
        key = re.sub(r"\W+", "", question["question"].lower())[:220]
        if key in seen:
            continue
        seen.add(key)
        deduped.append(question)

    return deduped


def question_to_front(question) -> str:
    title = f"C\u00e2u {question['number']}. {question['question']}" if question["number"] else question["question"]
    option_lines = [
        f"{option['label']}. {option['text'].rstrip('.')}"
        for option in question["options"]
    ]
    return "<br>".join(html.escape(line) for line in [title, "", *option_lines])


def question_to_back(question) -> str:
    answer = question["answer"]
    if not answer:
        return (
            "Ch\u01b0a t\u00ecm th\u1ea5y \u0111\u00e1p \u00e1n r\u00f5 trong PDF.<br>"
            "Tag: need-answer. C\u1ea7n ki\u1ec3m ch\u1ee9ng/b\u1ed5 sung tr\u01b0\u1edbc khi thi."
        )

    return (
        f"\u0110\u00e1p \u00e1n: {html.escape(answer['label'])}. {html.escape(answer['text'])}<br>"
        f"Ngu\u1ed3n: PDF \u0111\u00e1nh d\u1ea5u ({html.escape(answer['confidence'])})."
    )


def make_deck(questions, source_pdf: Path):
    now = dt.datetime.now(dt.UTC).isoformat()
    cards = []

    for index, question in enumerate(questions, start=1):
        tags = ["LSĐ", "PDF", "trac-nghiem"]
        if question["answer"]:
            tags.append(f"answer-{question['answer']['confidence']}")
        else:
            tags.append("need-answer")

        cards.append(
            {
                "id": f"lsd-pdf-{index}-{uuid.uuid4()}",
                "front": question_to_front(question),
                "back": question_to_back(question),
                "tags": tags,
                "ease": 2.5,
                "interval": 1,
                "step": 0,
            }
        )

    return {
        "id": f"deck-lsd-pdf-{uuid.uuid4()}",
        "name": "B\u1ed9 730 c\u00e2u tr\u1eafc nghi\u1ec7m LS\u0110 - PDF",
        "description": f"Imported from {source_pdf.name}. C\u00e2u kh\u00f4ng c\u00f3 \u0111\u00e1p \u00e1n r\u00f5 \u0111\u01b0\u1ee3c g\u1eafn tag need-answer.",
        "language": "Vietnamese",
        "category": "L\u1ecbch s\u1eed \u0110\u1ea3ng",
        "createdAt": now,
        "cards": cards,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--out", type=Path, default=Path("output/decks/lsd-730-pdf.json"))
    parser.add_argument("--report", type=Path, default=Path("output/decks/lsd-730-pdf-report.json"))
    parser.add_argument("--dedupe", action="store_true")
    args = parser.parse_args()

    text = normalize_pdf_text(args.pdf)
    questions = parse_questions(text)
    raw_total = len(questions)
    if args.dedupe:
        questions = dedupe_questions(questions)
    deck = make_deck(questions, args.pdf)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps([deck], ensure_ascii=False, indent=2), encoding="utf-8")

    missing = [question for question in questions if not question["answer"]]
    report = {
        "source": str(args.pdf),
        "dedupe": args.dedupe,
        "rawTotalParsed": raw_total,
        "totalParsed": len(questions),
        "withAnswer": len(questions) - len(missing),
        "missingAnswer": len(missing),
        "missingAnswerQuestions": missing,
    }
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps({k: report[k] for k in ["totalParsed", "withAnswer", "missingAnswer"]}, ensure_ascii=False))
    print(args.out)
    print(args.report)


if __name__ == "__main__":
    main()
