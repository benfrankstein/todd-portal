'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('email_templates', [
      {
        template_name: 'user_welcome',
        subject: 'Welcome to Coastal Private Lending Portal',
        greeting: 'Hello {{firstName}}',
        body_message: 'Welcome to the Coastal Private Lending Portal! Your account has been created.\n\nYour login credentials:\nEmail: {{email}}\nTemporary Password: {{password}}\n\nPlease visit {{portalUrl}} to log in and complete your profile setup. You will be prompted to create a new password and verify your phone number on first login.',
        closing_message: 'If you have any questions or need assistance, please don\'t hesitate to contact us.\n\nWelcome aboard!',
        signature: 'Coastal Private Lending Team',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('email_templates', {
      template_name: 'user_welcome'
    }, {});
  }
};
