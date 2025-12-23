"""
Database operations for invoice generation
"""
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import List, Dict, Optional
from datetime import date


class DatabaseManager:
    def __init__(self, database_url: str):
        self.database_url = database_url
        self.conn = None

    def connect(self):
        """Establish database connection"""
        self.conn = psycopg2.connect(self.database_url)
        return self.conn

    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()

    def get_all_businesses(self) -> List[str]:
        """Get all unique business names from funded table (clients/borrowers)"""
        with self.conn.cursor() as cursor:
            cursor.execute("""
                SELECT DISTINCT business_name
                FROM funded
                WHERE business_name IS NOT NULL
                AND business_name != ''
                ORDER BY business_name
            """)
            return [row[0] for row in cursor.fetchall()]

    def get_all_investors(self) -> List[str]:
        """Get all unique investor names from promissory table"""
        with self.conn.cursor as cursor:
            cursor.execute("""
                SELECT DISTINCT investor_name
                FROM promissory
                WHERE investor_name IS NOT NULL
                AND investor_name != ''
                ORDER BY investor_name
            """)
            return [row[0] for row in cursor.fetchall()]

    def get_all_cap_investors(self) -> List[str]:
        """Get all unique investor names from capinvestor table"""
        with self.conn.cursor() as cursor:
            cursor.execute("""
                SELECT DISTINCT investor_name
                FROM capinvestor
                WHERE investor_name IS NOT NULL
                AND investor_name != ''
                ORDER BY investor_name
            """)
            return [row[0] for row in cursor.fetchall()]

    def get_business_records(self, business_name: str) -> List[Dict]:
        """Get all funded records for a business"""
        with self.conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT *
                FROM funded
                WHERE business_name = %s
                ORDER BY project_address
            """, (business_name,))
            return cursor.fetchall()

    def get_investor_records(self, investor_name: str) -> List[Dict]:
        """Get active promissory records for an investor"""
        with self.conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT *
                FROM promissory
                WHERE investor_name = %s
                AND (status IS NULL OR status != 'closed')
                ORDER BY fund_date
            """, (investor_name,))
            return cursor.fetchall()

    def get_cap_investor_records(self, investor_name: str) -> List[Dict]:
        """Get active capinvestor records for an investor"""
        with self.conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT *
                FROM capinvestor
                WHERE investor_name = %s
                AND (loan_status IS NULL OR loan_status != 'closed')
                ORDER BY property_address
            """, (investor_name,))
            return cursor.fetchall()

    def save_invoice_record(self, business_name: str, role: str, invoice_date: date,
                           file_name: str, s3_key: str, s3_url: str,
                           total_amount: float, record_count: int):
        """Save invoice metadata to database"""
        with self.conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO invoices
                (business_name, role, invoice_date, file_name, s3_key, s3_url, total_amount, record_count)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (business_name, role, invoice_date)
                DO UPDATE SET
                    file_name = EXCLUDED.file_name,
                    s3_key = EXCLUDED.s3_key,
                    s3_url = EXCLUDED.s3_url,
                    total_amount = EXCLUDED.total_amount,
                    record_count = EXCLUDED.record_count,
                    updated_at = CURRENT_TIMESTAMP
            """, (business_name, role, invoice_date, file_name, s3_key, s3_url, total_amount, record_count))
            self.conn.commit()
