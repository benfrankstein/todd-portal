"""
PDF generation from HTML template
"""
from weasyprint import HTML, CSS
from jinja2 import Environment, FileSystemLoader
from datetime import datetime
from typing import List, Dict
import os
import logging

logger = logging.getLogger(__name__)


class PDFGenerator:
    def __init__(self, template_dir: str):
        self.template_dir = template_dir
        self.env = Environment(loader=FileSystemLoader(template_dir))

    def format_currency(self, value) -> str:
        """Format number as currency"""
        try:
            return f"${float(value):,.2f}"
        except (ValueError, TypeError):
            return "$0.00"

    def format_percent(self, value) -> str:
        """Format number as percentage"""
        try:
            return f"{float(value):.2f}%"
        except (ValueError, TypeError):
            return "0.00%"

    def format_date(self, value) -> str:
        """Format date"""
        if not value:
            return "N/A"
        if isinstance(value, str):
            try:
                value = datetime.strptime(value, '%Y-%m-%d')
            except:
                return value
        if isinstance(value, datetime):
            return value.strftime('%m/%d/%Y')
        return str(value)

    def split_records_into_pages(self, records: List[Dict], first_page_rows: int = 12,
                                 subsequent_rows: int = 20) -> List[Dict]:
        """
        Split records into pages

        Args:
            records: List of record dictionaries
            first_page_rows: Number of rows on first page
            subsequent_rows: Number of rows on subsequent pages

        Returns:
            List of page data dictionaries
        """
        pages = []

        if len(records) <= first_page_rows:
            pages.append({'records': records})
        else:
            # First page
            pages.append({'records': records[:first_page_rows]})
            remaining = records[first_page_rows:]

            # Subsequent pages
            while remaining:
                pages.append({'records': remaining[:subsequent_rows]})
                remaining = remaining[subsequent_rows:]

        return pages

    def generate_invoice_pdf(self, business_name: str, role: str, records: List[Dict],
                           invoice_date: datetime, logo_url: str = None) -> bytes:
        """
        Generate invoice PDF

        Args:
            business_name: Name of business/investor
            role: 'client', 'investor', or 'capinvestor'
            records: List of loan/investment records
            invoice_date: Date for the invoice
            logo_url: Optional URL to logo image

        Returns:
            bytes: PDF content
        """
        # Calculate totals
        total_invested = 0
        monthly_interest = 0
        total_interest_due = 0

        if role == 'client':
            total_interest_due = sum(float(r.get('interest_payment', 0) or 0) for r in records)
        elif role == 'investor':
            total_invested = sum(float(r.get('loan_amount', 0) or 0) for r in records)
            monthly_interest = sum(float(r.get('capital_pay', 0) or 0) for r in records)
        elif role == 'capinvestor':
            total_invested = sum(float(r.get('loan_amount', 0) or 0) for r in records)
            monthly_interest = sum(float(r.get('payment', 0) or 0) for r in records)

        # Format records for template
        formatted_records = []
        for record in records:
            formatted = dict(record)
            # Format currency and percentage fields
            if 'loan_amount' in formatted:
                formatted['loan_amount'] = self.format_currency(formatted['loan_amount'])
            if 'interest_rate' in formatted:
                formatted['interest_rate'] = self.format_percent(formatted['interest_rate'])
            if 'interest_payment' in formatted:
                formatted['interest_payment'] = self.format_currency(formatted['interest_payment'])
            if 'payment' in formatted:
                formatted['payment'] = self.format_currency(formatted['payment'])
            if 'capital_pay' in formatted:
                formatted['capital_pay'] = self.format_currency(formatted['capital_pay'])
            if 'fund_date' in formatted:
                formatted['fund_date'] = self.format_date(formatted['fund_date'])

            formatted_records.append(formatted)

        # Split into pages
        pages = self.split_records_into_pages(formatted_records)

        # Prepare template context
        context = {
            'business_name': business_name,
            'role': role,
            'invoice_date': invoice_date.strftime('%B %d, %Y'),
            'total_invested': self.format_currency(total_invested),
            'monthly_interest': self.format_currency(monthly_interest),
            'total_interest_due': self.format_currency(total_interest_due),
            'pages': pages,
            'logo_url': logo_url
        }

        # Render template
        template = self.env.get_template('invoice_template.html')
        html_content = template.render(**context)

        # Generate PDF
        pdf = HTML(string=html_content).write_pdf()

        logger.info(f"Generated PDF for {business_name} ({role}): {len(records)} records, {len(pages)} pages")

        return pdf
