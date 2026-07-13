# Existing Site Archive

This directory contains a Wget mirror of `https://www.gfcmuaythai.co.uk`,
captured on 13 July 2026, plus public pages discovered through search results
that were not linked by the live navigation.

The matching files under `markdown/` were generated from the archived HTML
with Pandoc 3.7.0.2 using GitHub-Flavoured Markdown output. They are retained
as source material and are excluded from the Eleventy build.

Some live features are server-side AdminMyMembers forms and cannot function in
the static mirror. The source also returned HTTP 500 for the timetable-by-age
page, HTTP 404 for its web manifest and Popper script, and country-block
placeholders for two linked Imgur images.
