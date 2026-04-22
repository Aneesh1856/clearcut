from fpdf import FPDF

pdf = FPDF()
pdf.add_page()
pdf.set_font("Arial", 'B', 16)
pdf.cell(200, 10, txt="SAMPLE RENTAL AGREEMENT (INDIA)", ln=True, align='C')
pdf.set_font("Arial", size=12)
pdf.ln(10)

text = """
This Rental Agreement is made on this 22nd day of April, 2026, between Mr. Sharma (Landlord) and Mr. Verma (Tenant).

1. TERM: The lease will be for a period of 11 months starting from May 1st, 2026.
2. RENT: The tenant agrees to pay a monthly rent of INR 25,000.
3. SECURITY DEPOSIT: A non-refundable security deposit of INR 1,00,000 shall be paid. [CRITICAL RISK: Security deposits are usually refundable in Indian Law].
4. TERMINATION: The landlord can terminate this agreement with 24 hours notice. [HIGH RISK: Standard notice is 30 days].
5. MAINTENANCE: All major and minor repairs shall be the sole responsibility of the tenant.
6. SUB-LETTING: The tenant is strictly prohibited from sub-letting the premises.
7. JURISDICTION: Any disputes shall be settled in the courts of New Delhi.

Signed,
Landlord: ___________
Tenant: ___________
"""

for line in text.split('\n'):
    pdf.multi_cell(0, 10, txt=line)

pdf.output("Legal_Sentinel_Test_Document.pdf")
print("PDF Generated successfully: Legal_Sentinel_Test_Document.pdf")
