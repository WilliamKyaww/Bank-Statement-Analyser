# Bank Statement Analyser

A local, browser-based dashboard for viewing and analysing bank statement transactions. It includes monthly cash-flow charts, expense categories, transaction filters, Lloyds/NatWest account filtering, statement viewing, editable categorisation keywords, and multi-month analysis.

**Warning: This project is vibe coded. It’s just a quick project I made to help me manage my finances. Hopefully you’ll find it useful too!**

## Privacy

Bank statements and extracted transactions are private. They are intentionally excluded from Git by `.gitignore`. Keep the `LLoyds` and `Natwest` folders on your computer, but do not force-add them to a commit.

The app works with local files and does not need a backend. Open `index.html` in a browser after adding your private statement files.

## Bank statement folder layout

Use these exact folder names at the repository root:

```text
LLoyds/
Natwest/
```

For Lloyds, use one PDF per month with this naming pattern:

```text
LLoyds/YYYY_Month_Statement.pdf
```

Examples:

```text
LLoyds/2026_January_Statement.pdf
LLoyds/2026_August_Statement.pdf
```

NatWest statements may cover multiple months, so they do not need to be split into monthly PDFs. Use a descriptive name containing the year and date range where possible:

```text
Natwest/YYYY_Month-Month_Natwest_Statement.pdf
```

Example:

```text
Natwest/2026_May-August_Natwest_Statement.pdf
```

The Statements page also lets you attach a PDF and choose whether it is Lloyds or NatWest. Attachments are kept in the current browser session.

## Running it

1. Add your private PDFs to `LLoyds/` or `Natwest/`.
2. Open `index.html` in a browser.
3. Use the bank, year, month, and money-in/money-out filters.
4. Use the Statements page to read the original PDF.
5. Use the Keywords page to update merchant categorisation rules.

If you add a new statement format or want new PDFs to contribute to the charts, update the local transaction extraction data without committing it.
