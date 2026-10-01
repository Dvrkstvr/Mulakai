from hallucinations import drop_hallucinations


def texts(*lines):
    return [s["text"] for s in drop_hallucinations([{"text": t} for t in lines])]


def test_stock_subtitle_lines_go_wherever_they_are():
    assert texts("Leg die KI in die Tüte", "Untertitelung des ZDF, 2020", "Ich tanz im Loop") == [
        "Leg die KI in die Tüte", "Ich tanz im Loop"]
    assert texts("Thanks for watching!", "Midnight city") == ["Midnight city"]
    assert texts("Thank you for listening! Please, like, Share, and Subscribe!", "Midnight city") == ["Midnight city"]


def test_segments_without_letters_go():
    assert texts("🎵", "Midnight city", "...", "2020") == ["Midnight city"]


def test_subtitle_cues_go_only_as_a_whole_segment():
    assert texts("... Musik ...", "Ich tanz im Loop", "[Music]", "Die Musik ist laut") == [
        "Ich tanz im Loop", "Die Musik ist laut"]
    assert texts("We'll be right back.", "Kopf hoch und tanz", "We'll be right back") == ["Kopf hoch und tanz"]
    assert texts("I'll be right back to you") == ["I'll be right back to you"]


def test_singable_phrases_go_only_at_the_end():
    assert texts("Thank you", "Midnight city", "Thank you.", "Bis zum nächsten Mal.", "Vielen Dank.") == [
        "Thank you", "Midnight city"]


def test_real_lyrics_are_kept_untouched():
    lines = ["Midnight city streets are wet", "Be still", "Be still", "Thank you for the night"]
    assert texts(*lines) == lines
