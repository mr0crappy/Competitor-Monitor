from bs4 import BeautifulSoup


def normalize_changelog(html, source_url="", source_type="generic"):
    if not html:
        return []

    content = html.lstrip()

    # Automatically detect XML / RSS / Atom feeds.
    if (
        content.startswith("<?xml")
        or "<feed" in content[:1000]
        or "<rss" in content[:1000]
        or "<channel" in content[:1000]
    ):
        return normalize_feed(html)

    # Otherwise treat it as a normal HTML page.
    soup = BeautifulSoup(html, "html.parser")

    return normalize_generic(soup)


def normalize_generic(soup):
    # Remove elements that usually contain navigation,
    # styling, scripts, or non-content UI.
    for element in soup(
        ["script", "style", "noscript", "svg", "nav", "footer", "header"]
    ):
        element.decompose()

    # Prefer the main content area when available.
    content = (
        soup.find("main")
        or soup.find("article")
        or soup.find(attrs={"role": "main"})
        or soup.body
        or soup
    )

    text = content.get_text("\n")

    lines = []

    for line in text.splitlines():
        line = " ".join(line.split())

        if line:
            lines.append(line)

    return list(dict.fromkeys(lines))


def normalize_feed(xml):
    soup = BeautifulSoup(xml, "xml")
    lines = []

    for entry in soup.find_all(["entry", "item"]):
        title = entry.find("title")
        published = entry.find(
            ["published", "updated", "pubDate"]
        )
        link = entry.find("link")

        if title:
            text = " ".join(
                title.get_text(" ", strip=True).split()
            )

            if text:
                lines.append(text)

        if published:
            text = " ".join(
                published.get_text(" ", strip=True).split()
            )

            if text:
                lines.append(text)

        if link:
            href = link.get("href") or link.get_text(
                " ", strip=True
            )

            if href:
                lines.append(href)

    return list(dict.fromkeys(lines))