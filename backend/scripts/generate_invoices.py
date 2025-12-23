#!/usr/bin/env python3
"""
Coastal Private Lending - Monthly Invoice Generator
Generates invoice PDFs for all businesses and investors and uploads to S3
"""
import os
import sys
from datetime import datetime
from dateutil.relativedelta import relativedelta
import logging
from dotenv import load_dotenv

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from invoice_generator.database import DatabaseManager
from invoice_generator.pdf_generator import PDFGenerator
from invoice_generator.s3_uploader import S3Uploader

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('invoice_generation.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


def generate_file_name(business_name: str, invoice_date: datetime) -> str:
    """
    Generate file name for invoice PDF

    Args:
        business_name: Name of business/investor
        invoice_date: Date of invoice

    Returns:
        str: File name (e.g., "Business_Name_November_1_2025.pdf")
    """
    # Clean business name
    clean_name = business_name.replace(' ', '_').replace('/', '_').replace('\\', '_')
    # Format date
    date_str = invoice_date.strftime('%B_%d_%Y')
    return f"{clean_name}_{date_str}.pdf"


def process_business(db: DatabaseManager, pdf_gen: PDFGenerator, s3: S3Uploader,
                    business_name: str, invoice_date: datetime, logo_url: str = None):
    """Process invoice for a single business (client/borrower)"""
    try:
        logger.info(f"Processing business: {business_name}")

        # Get records
        records = db.get_business_records(business_name)

        if not records:
            logger.warning(f"No records found for business: {business_name}")
            return

        # Generate PDF
        pdf_content = pdf_gen.generate_invoice_pdf(
            business_name=business_name,
            role='client',
            records=records,
            invoice_date=invoice_date,
            logo_url=logo_url
        )

        # Generate file name
        file_name = generate_file_name(business_name, invoice_date)

        # Upload to S3
        s3_key = s3.generate_s3_key('client', business_name, file_name)
        s3_url = s3.upload_pdf(pdf_content, s3_key)

        # Calculate total
        total_amount = sum(float(r.get('interest_payment', 0) or 0) for r in records)

        # Save to database
        db.save_invoice_record(
            business_name=business_name,
            role='client',
            invoice_date=invoice_date.date(),
            file_name=file_name,
            s3_key=s3_key,
            s3_url=s3_url,
            total_amount=total_amount,
            record_count=len(records)
        )

        logger.info(f"✓ Successfully processed {business_name}: {len(records)} records, ${total_amount:,.2f}")

    except Exception as e:
        logger.error(f"✗ Failed to process business {business_name}: {str(e)}", exc_info=True)


def process_investor(db: DatabaseManager, pdf_gen: PDFGenerator, s3: S3Uploader,
                    investor_name: str, invoice_date: datetime, logo_url: str = None):
    """Process invoice for a single investor (promissory)"""
    try:
        logger.info(f"Processing investor: {investor_name}")

        # Get active records
        records = db.get_investor_records(investor_name)

        if not records:
            logger.warning(f"No active records found for investor: {investor_name}")
            return

        # Generate PDF
        pdf_content = pdf_gen.generate_invoice_pdf(
            business_name=investor_name,
            role='investor',
            records=records,
            invoice_date=invoice_date,
            logo_url=logo_url
        )

        # Generate file name
        file_name = generate_file_name(investor_name, invoice_date)

        # Upload to S3
        s3_key = s3.generate_s3_key('investor', investor_name, file_name)
        s3_url = s3.upload_pdf(pdf_content, s3_key)

        # Calculate totals
        total_amount = sum(float(r.get('loan_amount', 0) or 0) for r in records)
        monthly_interest = sum(float(r.get('capital_pay', 0) or 0) for r in records)

        # Save to database
        db.save_invoice_record(
            business_name=investor_name,
            role='investor',
            invoice_date=invoice_date.date(),
            file_name=file_name,
            s3_key=s3_key,
            s3_url=s3_url,
            total_amount=monthly_interest,
            record_count=len(records)
        )

        logger.info(f"✓ Successfully processed {investor_name}: {len(records)} records, ${monthly_interest:,.2f}/month")

    except Exception as e:
        logger.error(f"✗ Failed to process investor {investor_name}: {str(e)}", exc_info=True)


def process_cap_investor(db: DatabaseManager, pdf_gen: PDFGenerator, s3: S3Uploader,
                        investor_name: str, invoice_date: datetime, logo_url: str = None):
    """Process invoice for a single cap investor"""
    try:
        logger.info(f"Processing cap investor: {investor_name}")

        # Get active records
        records = db.get_cap_investor_records(investor_name)

        if not records:
            logger.warning(f"No active records found for cap investor: {investor_name}")
            return

        # Generate PDF
        pdf_content = pdf_gen.generate_invoice_pdf(
            business_name=investor_name,
            role='capinvestor',
            records=records,
            invoice_date=invoice_date,
            logo_url=logo_url
        )

        # Generate file name
        file_name = generate_file_name(investor_name, invoice_date)

        # Upload to S3
        s3_key = s3.generate_s3_key('capinvestor', investor_name, file_name)
        s3_url = s3.upload_pdf(pdf_content, s3_key)

        # Calculate totals
        total_amount = sum(float(r.get('loan_amount', 0) or 0) for r in records)
        monthly_interest = sum(float(r.get('payment', 0) or 0) for r in records)

        # Save to database
        db.save_invoice_record(
            business_name=investor_name,
            role='capinvestor',
            invoice_date=invoice_date.date(),
            file_name=file_name,
            s3_key=s3_key,
            s3_url=s3_url,
            total_amount=monthly_interest,
            record_count=len(records)
        )

        logger.info(f"✓ Successfully processed {investor_name}: {len(records)} records, ${monthly_interest:,.2f}/month")

    except Exception as e:
        logger.error(f"✗ Failed to process cap investor {investor_name}: {str(e)}", exc_info=True)


def main():
    """Main execution function"""
    logger.info("=" * 80)
    logger.info("Starting Monthly Invoice Generation")
    logger.info("=" * 80)

    # Load environment variables
    load_dotenv()

    # Get configuration
    database_url = os.getenv('DATABASE_URL')
    aws_access_key = os.getenv('AWS_ACCESS_KEY_ID')
    aws_secret_key = os.getenv('AWS_SECRET_ACCESS_KEY')
    aws_region = os.getenv('AWS_REGION', 'us-east-1')
    s3_bucket = os.getenv('S3_BUCKET_NAME')
    logo_url = os.getenv('LOGO_URL')

    # Validate configuration
    if not all([database_url, aws_access_key, aws_secret_key, s3_bucket]):
        logger.error("Missing required environment variables!")
        logger.error("Required: DATABASE_URL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME")
        sys.exit(1)

    # Use first of current month as invoice date
    invoice_date = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    logger.info(f"Invoice Date: {invoice_date.strftime('%B %d, %Y')}")

    # Initialize components
    logger.info("Initializing components...")
    db = DatabaseManager(database_url)
    db.connect()

    template_dir = os.path.join(os.path.dirname(__file__), 'invoice_generator', 'templates')
    pdf_gen = PDFGenerator(template_dir)

    s3 = S3Uploader(aws_access_key, aws_secret_key, aws_region, s3_bucket)

    # Statistics
    stats = {
        'clients': {'processed': 0, 'failed': 0},
        'investors': {'processed': 0, 'failed': 0},
        'capinvestors': {'processed': 0, 'failed': 0}
    }

    try:
        # Process all businesses (clients/borrowers)
        logger.info("\n" + "=" * 80)
        logger.info("Processing Businesses (Clients/Borrowers)")
        logger.info("=" * 80)
        businesses = db.get_all_businesses()
        logger.info(f"Found {len(businesses)} businesses")

        for business_name in businesses:
            try:
                process_business(db, pdf_gen, s3, business_name, invoice_date, logo_url)
                stats['clients']['processed'] += 1
            except Exception as e:
                stats['clients']['failed'] += 1
                logger.error(f"Failed to process business {business_name}: {e}")

        # Process all investors (promissory)
        logger.info("\n" + "=" * 80)
        logger.info("Processing Investors (Promissory)")
        logger.info("=" * 80)
        investors = db.get_all_investors()
        logger.info(f"Found {len(investors)} investors")

        for investor_name in investors:
            try:
                process_investor(db, pdf_gen, s3, investor_name, invoice_date, logo_url)
                stats['investors']['processed'] += 1
            except Exception as e:
                stats['investors']['failed'] += 1
                logger.error(f"Failed to process investor {investor_name}: {e}")

        # Process all cap investors
        logger.info("\n" + "=" * 80)
        logger.info("Processing Cap Investors")
        logger.info("=" * 80)
        cap_investors = db.get_all_cap_investors()
        logger.info(f"Found {len(cap_investors)} cap investors")

        for investor_name in cap_investors:
            try:
                process_cap_investor(db, pdf_gen, s3, investor_name, invoice_date, logo_url)
                stats['capinvestors']['processed'] += 1
            except Exception as e:
                stats['capinvestors']['failed'] += 1
                logger.error(f"Failed to process cap investor {investor_name}: {e}")

    finally:
        db.close()

    # Print summary
    logger.info("\n" + "=" * 80)
    logger.info("Invoice Generation Complete")
    logger.info("=" * 80)
    logger.info(f"Clients:       {stats['clients']['processed']} processed, {stats['clients']['failed']} failed")
    logger.info(f"Investors:     {stats['investors']['processed']} processed, {stats['investors']['failed']} failed")
    logger.info(f"Cap Investors: {stats['capinvestors']['processed']} processed, {stats['capinvestors']['failed']} failed")
    logger.info("=" * 80)

    total_processed = stats['clients']['processed'] + stats['investors']['processed'] + stats['capinvestors']['processed']
    total_failed = stats['clients']['failed'] + stats['investors']['failed'] + stats['capinvestors']['failed']
    logger.info(f"TOTAL: {total_processed} successful, {total_failed} failed")


if __name__ == '__main__':
    main()
