/**
 * WhatsApp Flow JSON definitions.
 * Register each of these with Meta Business Manager → Flows.
 * Schema version: 3.1
 */

interface FlowScreen {
  id: string;
  title: string;
  layout: {
    type: string;
    children: FlowComponent[];
  };
}

interface FlowComponent {
  type: string;
  [key: string]: unknown;
}

interface WhatsAppFlowDefinition {
  version: '3.1';
  screens: FlowScreen[];
}

// ─── Site Visit Booking Flow ──────────────────────────────────────────────────

export const SITE_VISIT_BOOKING_FLOW: WhatsAppFlowDefinition = {
  version: '3.1',
  screens: [
    {
      id: 'MAIN',
      title: 'Site Visit Booking',
      layout: {
        type: 'SingleColumnLayout',
        children: [
          {
            type: 'TextHeading',
            text: 'Book Your Site Visit',
          },
          {
            type: 'TextBody',
            text: 'Choose a date and time that works for you. Our designer will confirm your appointment shortly.',
          },
          {
            type: 'DatePicker',
            name: 'visit_date',
            label: 'Preferred Date',
            required: true,
          },
          {
            type: 'Dropdown',
            name: 'visit_time',
            label: 'Preferred Time Slot',
            required: true,
            'data-source': [
              { id: '0900', title: '9:00 AM – 11:00 AM' },
              { id: '1100', title: '11:00 AM – 1:00 PM' },
              { id: '1400', title: '2:00 PM – 4:00 PM' },
              { id: '1600', title: '4:00 PM – 6:00 PM' },
            ],
          },
          {
            type: 'TextInput',
            name: 'notes',
            label: 'Any notes for our designer?',
            required: false,
            'input-type': 'text',
          },
          {
            type: 'Footer',
            label: 'Confirm Booking',
            on_click_action: {
              name: 'complete',
              payload: {
                visit_date: '${form.visit_date}',
                visit_time: '${form.visit_time}',
                notes: '${form.notes}',
              },
            },
          },
        ],
      },
    },
  ],
};

// ─── Daily Progress Flow ──────────────────────────────────────────────────────

export const DAILY_PROGRESS_FLOW: WhatsAppFlowDefinition = {
  version: '3.1',
  screens: [
    {
      id: 'MAIN',
      title: 'Daily Site Progress',
      layout: {
        type: 'SingleColumnLayout',
        children: [
          {
            type: 'TextHeading',
            text: "Today's Site Update",
          },
          {
            type: 'TextBody',
            text: 'Fill in the progress details for today. Your report will be shared with the project team.',
          },
          {
            type: 'NumberInput',
            name: 'progress_pct',
            label: 'Overall Progress (%)',
            required: true,
            'min-value': 0,
            'max-value': 100,
            'helper-text': 'Enter a value between 0 and 100',
          },
          {
            type: 'TextInput',
            name: 'current_stage',
            label: 'Current Work Stage',
            required: true,
            'input-type': 'text',
            'helper-text': 'e.g. Carpentry, Tiling, Painting',
          },
          {
            type: 'NumberInput',
            name: 'labour_count',
            label: 'Number of Workers on Site',
            required: false,
            'min-value': 0,
          },
          {
            type: 'CheckboxGroup',
            name: 'has_delay',
            label: 'Is there a delay today?',
            required: false,
            'data-source': [
              { id: 'yes', title: 'Yes, there is a delay' },
            ],
          },
          {
            type: 'TextArea',
            name: 'blockers',
            label: 'Blockers / Issues (if any)',
            required: false,
            'helper-text': 'Material delays, access issues, etc.',
          },
          {
            type: 'Footer',
            label: 'Submit Update',
            on_click_action: {
              name: 'complete',
              payload: {
                progress_pct: '${form.progress_pct}',
                current_stage: '${form.current_stage}',
                labour_count: '${form.labour_count}',
                has_delay: '${form.has_delay}',
                blockers: '${form.blockers}',
              },
            },
          },
        ],
      },
    },
  ],
};

// ─── Snag Sign-off Flow ───────────────────────────────────────────────────────

export const SNAG_SIGNOFF_FLOW: WhatsAppFlowDefinition = {
  version: '3.1',
  screens: [
    {
      id: 'MAIN',
      title: 'Snag Item Sign-off',
      layout: {
        type: 'SingleColumnLayout',
        children: [
          {
            type: 'TextHeading',
            text: 'Snag Item Review',
          },
          {
            type: 'TextBody',
            text: 'Please review the snag item described below and confirm whether it has been resolved to your satisfaction.',
          },
          {
            type: 'TextInput',
            name: 'snag_description',
            label: 'Snag Description',
            required: true,
            'input-type': 'text',
            'helper-text': 'Describe the issue or confirm the fix details',
          },
          {
            type: 'RadioButtonsGroup',
            name: 'decision',
            label: 'Your Decision',
            required: true,
            'data-source': [
              { id: 'approve', title: 'Approve — issue is resolved' },
              { id: 'reject', title: 'Reject — further work needed' },
            ],
          },
          {
            type: 'TextArea',
            name: 'remarks',
            label: 'Remarks (optional)',
            required: false,
            'helper-text': 'Add any comments for the team',
          },
          {
            type: 'Footer',
            label: 'Submit Decision',
            on_click_action: {
              name: 'complete',
              payload: {
                snag_description: '${form.snag_description}',
                decision: '${form.decision}',
                remarks: '${form.remarks}',
              },
            },
          },
        ],
      },
    },
  ],
};
