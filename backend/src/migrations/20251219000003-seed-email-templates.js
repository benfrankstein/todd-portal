'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('email_templates', [
      {
        template_name: 'invoice_client',
        subject: 'Monthly Loan Invoice - {{month}} {{year}}',
        greeting: 'Dear Valued Client',
        body_message: 'Please find attached your monthly loan invoice statement.',
        closing_message: 'Your detailed invoice is attached as a PDF document. If you have any questions or concerns, please don\'t hesitate to contact us.\n\nThank you for your continued partnership.',
        signature: 'Coastal Private Lending Team',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        template_name: 'invoice_investor',
        subject: 'Monthly Investment Statement - {{month}} {{year}}',
        greeting: 'Dear Valued Investor',
        body_message: 'Please find attached your monthly investment earnings statement.',
        closing_message: 'Your detailed invoice is attached as a PDF document. If you have any questions or concerns, please don\'t hesitate to contact us.\n\nThank you for your continued partnership.',
        signature: 'Coastal Private Lending Team',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        template_name: 'invoice_capinvestor',
        subject: 'Monthly Investment Statement - {{month}} {{year}}',
        greeting: 'Dear Valued Investor',
        body_message: 'Please find attached your monthly capital investment earnings statement.',
        closing_message: 'Your detailed invoice is attached as a PDF document. If you have any questions or concerns, please don\'t hesitate to contact us.\n\nThank you for your continued partnership.',
        signature: 'Coastal Private Lending Team',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('email_templates', {
      template_name: {
        [Sequelize.Op.in]: ['invoice_client', 'invoice_investor', 'invoice_capinvestor']
      }
    }, {});
  }
};
