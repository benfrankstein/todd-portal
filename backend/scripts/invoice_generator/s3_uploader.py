"""
S3 upload operations for invoice PDFs
"""
import boto3
from botocore.exceptions import ClientError
import logging

logger = logging.getLogger(__name__)


class S3Uploader:
    def __init__(self, aws_access_key_id: str, aws_secret_access_key: str,
                 region: str, bucket_name: str):
        self.bucket_name = bucket_name
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key,
            region_name=region
        )

    def upload_pdf(self, pdf_content: bytes, s3_key: str) -> str:
        """
        Upload PDF to S3 and return the URL

        Args:
            pdf_content: PDF file content as bytes
            s3_key: S3 object key (path within bucket)

        Returns:
            str: S3 URL of uploaded file
        """
        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=pdf_content,
                ContentType='application/pdf',
                ServerSideEncryption='AES256'  # Encrypt at rest
            )

            # Generate the S3 URL
            url = f"https://{self.bucket_name}.s3.amazonaws.com/{s3_key}"
            logger.info(f"Successfully uploaded PDF to {url}")
            return url

        except ClientError as e:
            logger.error(f"Failed to upload PDF to S3: {e}")
            raise

    def generate_s3_key(self, role: str, business_name: str, file_name: str) -> str:
        """
        Generate S3 key (path) for the invoice

        Args:
            role: 'client', 'investor', or 'capinvestor'
            business_name: Name of business/investor
            file_name: Name of the PDF file

        Returns:
            str: S3 key path
        """
        # Map roles to folder names
        folder_map = {
            'client': 'clients',
            'investor': 'investors',
            'capinvestor': 'capinvestors'
        }

        folder = folder_map.get(role, role)
        # Clean business name for folder path
        clean_business_name = business_name.replace('/', '_').replace('\\', '_')

        return f"invoices/{folder}/{clean_business_name}/{file_name}"
