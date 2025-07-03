'use client';

import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import RadioGroup from '@mui/material/RadioGroup';
import Radio from '@mui/material/Radio';
import CircularProgress from '@mui/material/CircularProgress';
import Autocomplete from '@mui/material/Autocomplete';
import PropTypes from 'prop-types';

export default function Popup_Form({
  button,
  title,
  fields,
  onSave,
  isLoading = false,
}) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const initial = {};
    fields.forEach((field) => {
      if (field.defaultValue !== undefined) {
        // Nếu là multi-select => defaultValue sẽ là mảng values
        if (field.type === 'multi-select') {
          // Nếu defaultValue truyền vào dạng array of objects {label, value}, ta map sang array of value
          if (
            Array.isArray(field.defaultValue) &&
            typeof field.defaultValue[0] === 'object'
          ) {
            initial[field.name] = field.defaultValue.map((item) => item.value);
          } else {
            initial[field.name] = field.defaultValue;
          }
        }
        // Nếu là checkbox => defaultValue sẽ là mảng values
        else if (field.type === 'checkbox') {
          // Trường hợp defaultValue là mảng
          if (Array.isArray(field.defaultValue)) {
            initial[field.name] = field.defaultValue;
          } else {
            initial[field.name] = []; // tuỳ biến
          }
        } else {
          // Trường hợp select / radio / date / input / textarea
          // => defaultValue là 1 value (string, number,...)
          initial[field.name] = field.defaultValue;
        }
      } else {
        // Nếu không có defaultValue
        if (field.type === 'multi-select') {
          initial[field.name] = [];
        } else if (field.type === 'checkbox') {
          // Mặc định checkbox rỗng => []
          initial[field.name] = [];
        } else {
          initial[field.name] = '';
        }
      }
    });
    setFormData(initial);
  }, [fields]);

  // Toggle dialog
  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    if (!isLoading) {
      setOpen(false);
    }
  };

  // Xử lý lưu
  const handleSave = () => {
    const newErrors = {};

    fields.forEach((field) => {
      if (field.required) {
        const value = formData[field.name];
        if (
          value === undefined ||
          value === null ||
          value === '' ||
          // Trường hợp multi-select / checkbox là mảng rỗng
          ((field.type === 'multi-select' || field.type === 'checkbox') &&
            Array.isArray(value) &&
            value.length === 0)
        ) {
          newErrors[field.name] = `${field.label} là trường bắt buộc`;
        }
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (onSave) onSave(formData);
    setOpen(false);
  };

  // Input, select, date, radio,... => set trực tiếp
  const handleInputChange = (name, value) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Xoá error nếu có
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Checkbox => lưu mảng các value đã chọn
  const handleCheckboxChange = (name, optionValue, isChecked) => {
    setFormData((prev) => {
      const selectedValues = Array.isArray(prev[name]) ? [...prev[name]] : [];
      if (isChecked) {
        // Nếu check => thêm vào mảng
        if (!selectedValues.includes(optionValue)) {
          selectedValues.push(optionValue);
        }
      } else {
        // Nếu bỏ check => xoá khỏi mảng
        const index = selectedValues.indexOf(optionValue);
        if (index > -1) {
          selectedValues.splice(index, 1);
        }
      }
      return { ...prev, [name]: selectedValues };
    });

    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  return (
    <>
      <div
        onClick={handleOpen}
        style={{ width: '100%', height: '100%' }}
        className="flex_center"
      >
        {button}
      </div>

      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        maxWidth="sm"
        sx={{ maxHeight: '100vh' }}
        disableEnforceFocus // Khắc phục lỗi aria-hidden
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header */}
          <Box
            className="Title_Popup"
            sx={{ p: 2, borderBottom: 'thin solid var(--border)' }}
          >
            {title}
          </Box>

          {/* Body */}
          <Box
            sx={{ flex: 1, overflowY: 'auto', p: 2 }}
            className="Wrap_Scroll"
          >
            {isLoading ? (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '200px',
                }}
              >
                <CircularProgress />
              </Box>
            ) : (
              fields.map((field, index) => {
                // Conditional rendering
                if (field.conditional) {
                  const dependentValue = field.conditional.dependsOn
                    .split('.')
                    .reduce((acc, key) => acc?.[key], formData);
                  if (dependentValue !== field.conditional.value) {
                    return null;
                  }
                }

                // INPUT
                if (field.type === 'input') {
                  return (
                    <TextField
                      key={index}
                      size="small"
                      label={field.label}
                      name={field.name}
                      value={formData[field.name] || ''}
                      onChange={(e) => handleInputChange(field.name, e.target.value)}
                      fullWidth
                      sx={{ m: '8px 0' }}
                      error={Boolean(errors[field.name])}
                      helperText={errors[field.name] || ''}
                      required={field.required}
                    />
                  );
                }

                // TEXTAREA
                if (field.type === 'textarea') {
                  return (
                    <TextField
                      key={index}
                      label={field.label}
                      name={field.name}
                      value={formData[field.name] || ''}
                      onChange={(e) => handleInputChange(field.name, e.target.value)}
                      sx={{ my: 1 }}
                      fullWidth
                      margin="normal"
                      multiline
                      rows={field.rows || 4}
                      error={Boolean(errors[field.name])}
                      helperText={errors[field.name] || ''}
                      required={field.required}
                    />
                  );
                }

                // SELECT
                if (field.type === 'select') {
                  return (
                    <Box key={index} sx={{ padding: '8px 0' }}>
                      <Select
                        size="small"
                        value={formData[field.name] || ''}
                        onChange={(e) => handleInputChange(field.name, e.target.value)}
                        fullWidth
                        displayEmpty
                        error={Boolean(errors[field.name])}
                      >
                        <MenuItem value="" disabled>
                          {field.label}
                        </MenuItem>
                        {field.options?.map((option, idx) => (
                          <MenuItem key={idx} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors[field.name] && (
                        <Box
                          sx={{
                            color: 'error.main',
                            mt: 0.5,
                            fontSize: '0.75rem',
                          }}
                        >
                          {errors[field.name]}
                        </Box>
                      )}
                    </Box>
                  );
                }

                // CHECKBOX (lưu mảng các value đã chọn)
                if (field.type === 'checkbox') {
                  return (
                    <Box key={index} sx={{ marginBottom: 2 }}>
                      <Box sx={{ marginBottom: 1 }}>{field.label}</Box>
                      <FormGroup row={field.horizontal}>
                        {field.options?.map((option, idx) => {
                          const isChecked = formData[field.name]?.includes(
                            option.value
                          );
                          return (
                            <FormControlLabel
                              key={idx}
                              control={
                                <Checkbox
                                  checked={!!isChecked}
                                  onChange={(e) =>
                                    handleCheckboxChange(
                                      field.name,
                                      option.value,
                                      e.target.checked
                                    )
                                  }
                                />
                              }
                              label={option.label}
                            />
                          );
                        })}
                      </FormGroup>
                      {errors[field.name] && (
                        <Box
                          sx={{
                            color: 'error.main',
                            mt: 0.5,
                            fontSize: '0.75rem',
                          }}
                        >
                          {errors[field.name]}
                        </Box>
                      )}
                    </Box>
                  );
                }

                // RADIO
                if (field.type === 'radio') {
                  return (
                    <Box key={index} sx={{ marginBottom: 2 }}>
                      <Box sx={{ marginBottom: 1 }}>{field.label}</Box>
                      <RadioGroup
                        row={field.horizontal}
                        value={formData[field.name] || ''}
                        onChange={(e) => handleInputChange(field.name, e.target.value)}
                      >
                        {field.options?.map((option, idx) => (
                          <FormControlLabel
                            key={idx}
                            value={option.value}
                            control={<Radio />}
                            label={option.label}
                          />
                        ))}
                      </RadioGroup>
                      {errors[field.name] && (
                        <Box
                          sx={{
                            color: 'error.main',
                            mt: 0.5,
                            fontSize: '0.75rem',
                          }}
                        >
                          {errors[field.name]}
                        </Box>
                      )}
                    </Box>
                  );
                }

                // DATE
                if (field.type === 'date') {
                  return (
                    <TextField
                      key={index}
                      type="date"
                      size="small"
                      label={field.label}
                      name={field.name}
                      value={formData[field.name] || ''}
                      onChange={(e) => handleInputChange(field.name, e.target.value)}
                      fullWidth
                      margin="normal"
                      InputLabelProps={{
                        shrink: true,
                      }}
                      error={Boolean(errors[field.name])}
                      helperText={errors[field.name] || ''}
                      required={field.required}
                    />
                  );
                }

                // MULTI-SELECT (Autocomplete) => Lưu mảng các value
                if (field.type === 'multi-select') {
                  const getOptionFromValue = (val) =>
                    field.options?.find((opt) => opt.value === val) || {
                      label: '',
                      value: '',
                    };

                  // Tạo mảng objects hiển thị
                  const selectedObjects = (formData[field.name] || []).map(
                    (val) => getOptionFromValue(val)
                  );

                  return (
                    <Box key={index} sx={{ my: 1 }}>
                      <Autocomplete
                        multiple
                        disablePortal // Fix lỗi aria-hidden
                        options={field.options || []}
                        getOptionLabel={(option) => option.label || ''}
                        value={selectedObjects}
                        onChange={(event, newValue) => {
                          // newValue là mảng object => ta chỉ lưu mảng value
                          const valuesOnly = newValue.map((item) => item.value);
                          handleInputChange(field.name, valuesOnly);
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label={field.label}
                            error={Boolean(errors[field.name])}
                            helperText={errors[field.name] || ''}
                            required={field.required}
                          />
                        )}
                      />
                    </Box>
                  );
                }

                return null;
              })
            )}
          </Box>

          {/* Footer */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'end',
              p: 2,
              py: 1,
              borderTop: 'thin solid var(--border)',
              gap: 1,
            }}
          >
            <Button onClick={handleClose} disabled={isLoading}>
              Thoát
            </Button>
            <Button onClick={!isLoading ? handleSave : null} disabled={isLoading}>
              Lưu
            </Button>
          </Box>
        </Box>
      </Dialog>
    </>
  );
}

Popup_Form.propTypes = {
  title: PropTypes.string.isRequired,
  fields: PropTypes.arrayOf(
    PropTypes.shape({
      type: PropTypes.oneOf([
        'input',
        'textarea',
        'select',
        'checkbox',
        'radio',
        'date',
        'multi-select',
      ]).isRequired,
      name: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      options: PropTypes.arrayOf(
        PropTypes.shape({
          label: PropTypes.string,
          value: PropTypes.any,
        })
      ),
      rows: PropTypes.number,
      horizontal: PropTypes.bool,
      conditional: PropTypes.shape({
        dependsOn: PropTypes.string,
        value: PropTypes.any,
      }),
      required: PropTypes.bool,
      defaultValue: PropTypes.any,
    })
  ).isRequired,
  onSave: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
};
