// Public copy for the sign-in page, the crawlable text and the structured data.
// Keep index.html's JSON-LD and noscript text in step with this file.
export const SITE_NAME = 'IMS Engine';
export const HEADLINE = 'Inventory management software for stock, purchases and sales';
export const LEAD =
  'IMS Engine keeps stock levels, suppliers, customers, purchases, sales, payments and profit reports in one account. Every purchase updates the item’s average cost, and every sale records the cost it was sold at.';

export const FEATURES = [
  { title: 'Live stock levels', text: 'See what is on the shelf, what needs reordering and what is out of stock.' },
  { title: 'Purchases at true cost', text: 'Each purchase updates the item’s weighted-average cost automatically.' },
  { title: 'Sales and invoices', text: 'Record sales, print invoices, and track what customers still owe you.' },
  { title: 'Payments and reports', text: 'Log receipts and supplier payments, then review sales, profit and monthly trends.' },
];

export const FAQS = [
  {
    q: 'What is IMS Engine?',
    a: 'IMS Engine is an inventory management system. It keeps stock levels, suppliers, customers, purchases, sales, payments and reports in one account.',
  },
  {
    q: 'How does IMS Engine calculate profit?',
    a: 'Each sale stores the item’s unit cost at the time of sale, so profit is the sale price minus that cost, even after later purchases change the average cost.',
  },
  {
    q: 'Can stock go below zero?',
    a: 'No. The database refuses any sale or stock-out that would take the quantity below zero.',
  },
  {
    q: 'Can I try it before creating an account?',
    a: 'Yes. The demo account loads sample items, purchases, sales and payments so you can explore every page.',
  },
  {
    q: 'Is my data private?',
    a: 'Each account sees only its own data. Passwords are stored as salted hashes, and two-step verification is available.',
  },
];
