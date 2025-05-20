import React from 'react';
import { Form, DatePicker } from 'antd';
import moment from 'moment';
import { FieldMetadata } from '../DynamicPropertyForm';

interface DateTimeFieldProps {
  fieldName: string;
  value: string | undefined;
  meta: FieldMetadata;
  onChange: (value: string | null) => void;
}

const DateTimeField: React.FC<DateTimeFieldProps> = ({ fieldName, value, meta, onChange }) => (
  <Form.Item
    label={
      <span>
        {meta.display_name}
        {meta.description && (
          <span style={{ fontSize: '12px', color: '#888', marginLeft: '8px' }}>
            ({meta.description})
          </span>
        )}
      </span>
    }
    name={fieldName}
  >
    <DatePicker
      style={{ width: '100%' }}
      showTime
      value={value ? moment(value) : undefined}
      onChange={date => onChange(date ? date.toISOString() : null)}
    />
  </Form.Item>
);

export default DateTimeField;
