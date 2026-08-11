from fastapi import APIRouter, HTTPException
from db import db

router = APIRouter(prefix="/api/bible", tags=["bible"])


@router.get("/books")
async def list_books():
    books = await db.bible_books.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    return books


@router.get("/books/{book_id}")
async def get_book(book_id: str):
    book = await db.bible_books.find_one({"book_id": book_id}, {"_id": 0})
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book


@router.get("/books/{book_id}/chapters/{chapter}")
async def get_chapter(book_id: str, chapter: int):
    book = await db.bible_books.find_one({"book_id": book_id}, {"_id": 0})
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if chapter < 1 or chapter > book.get("chapters", 1):
        raise HTTPException(status_code=404, detail="Chapter not found")
    doc = await db.bible_verses.find_one(
        {"book_id": book_id, "chapter": chapter}, {"_id": 0}
    )
    verses = doc.get("verses", []) if doc else []
    return {
        "book_id": book_id,
        "book_name": book.get("name"),
        "chapter": chapter,
        "total_chapters": book.get("chapters"),
        "verses": verses,
        "has_audio": bool(doc and doc.get("audio_url")),
        "audio_url": doc.get("audio_url") if doc else None,
    }
