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

export default function Popup_Form_0({
  /** Quản lý mở/đóng từ bên ngoài */
  open,             
  onClose,

  /** Tiêu đề Dialog */
  title,

  /** Mảng cấu hình các field trong form */
  fields,

  /** Xử lý khi bấm Lưu */
  onSave,

  /** Đang loading hay không */
  isLoading = false,
}) {
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});

  // Khởi tạo state form theo fields
  useEffect(() => {
    const initial = {};
    fields.forEach((field) => {
      // Có defaultValue
      if (field.defaultValue !== undefined) {
        // Multi-select
        if (field.type === 'multi-select') {
          if (
            Array.isArray(field.defaultValue) &&
            typeof field.defaultValue[0] === 'object'
          ) {
            // defaultValue = [{label, value}, ...]
            initial[field.name] = field.defaultValue.map((item) => item.value);
          } else {
            // defaultValue = [val1, val2, ...] hoặc 1 value
            initial[field.name] = field.defaultValue;
          }
        }
        // Checkbox
        else if (field.type === 'checkbox') {
          // defaultValue = [val1, val2, ...] hoặc rỗng
          if (Array.isArray(field.defaultValue)) {
            initial[field.name] = field.defaultValue;
          } else {
            initial[field.name] = [];
          }
        }
        // input, select, radio, date, textarea => defaultValue là 1 value (string, number)
        else {
          initial[field.name] = field.defaultValue;
        }
      }
      // Không có defaultValue
      else {
        if (field.type === 'multi-select') {
          initial[field.name] = [];
        } else if (field.type === 'checkbox') {
          initial[field.name] = [];
        } else {
          initial[field.name] = '';
        }
      }
    });
    setFormData(initial);
  }, [fields]);

  /**
   * Validate & Gọi onSave
   */
  const handleSave = () => {
    const newErrors = {};

    // Duyệt field và kiểm tra bắt buộc
    fields.forEach((field) => {
      if (field.required) {
        const value = formData[field.name];
        // Rỗng, undefined => lỗi
        const isEmpty =
          value === undefined ||
          value === null ||
          value === '' ||
          (
            // Trường hợp multi-select / checkbox => mảng rỗng
            (field.type === 'multi-select' || field.type === 'checkbox') &&
            Array.isArray(value) &&
            value.length === 0
          );

        if (isEmpty) {
          newErrors[field.name] = `${field.label} là trường bắt buộc`;
        }
      }
    });

    // Nếu có lỗi => setErrors
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Không lỗi => gọi onSave
    onSave?.(formData);

    // Đóng dialog
    onClose?.();
  };

  /**
   * Xử lý Input/Select/Radio/Date
   */
  const handleInputChange = (name, value) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Xoá error cũ (nếu có)
    if (errors[name]) {
      setErrors((prevErr) => {
        const updated = { ...prevErr };
        delete updated[name];
        return updated;
      });
    }
  };

  /**
   * Xử lý Checkbox => mảng các value đã chọn
   */
  const handleCheckboxChange = (name, optionValue, isChecked) => {
    setFormData((prev) => {
      const selectedValues = Array.isArray(prev[name]) ? [...prev[name]] : [];
      if (isChecked) {
        // Thêm value nếu chưa có
        if (!selectedValues.includes(optionValue)) {
          selectedValues.push(optionValue);
        }
      } else {
        // Bỏ value
        const index = selectedValues.indexOf(optionValue);
        if (index > -1) {
          selectedValues.splice(index, 1);
        }
      }
      return { ...prev, [name]: selectedValues };
    });

    // Xoá error cũ (nếu có)
    if (errors[name]) {
      setErrors((prevErr) => {
        const updated = { ...prevErr };
        delete updated[name];
        return updated;
      });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      sx={{ maxHeight: '100vh' }}
      disableEnforceFocus
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <Box
          className="Title_Popup"
          sx={{ p: 2, borderBottom: 'thin solid var(--background_1)' }}
        >
          {title}
        </Box>

        {/* Body */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }} className="Wrap_Scroll">
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
              // Xử lý hiển thị theo logic điều kiện (nếu có)
              if (field.conditional) {
                const dependentValue = field.conditional.dependsOn
                  .split('.')
                  .reduce((acc, key) => acc?.[key], formData);
                if (dependentValue !== field.conditional.value) {
                  return null; // Không thỏa điều kiện => không hiển thị
                }
              }

              // ====== Render các loại field ======
              // 1) Input
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

              // 2) Textarea
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

              // 3) Select
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

              // 4) Checkbox
              if (field.type === 'checkbox') {
                return (
                  <Box key={index} sx={{ marginBottom: 2 }}>
                    <Box sx={{ marginBottom: 1 }}>{field.label}</Box>
                    <FormGroup row={field.horizontal}>
                      {field.options?.map((option, idx) => {
                        const isChecked = formData[field.name]?.includes(option.value);
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

              // 5) Radio
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

              // 6) Date
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

              // 7) Multi-select (Autocomplete multiple)
              if (field.type === 'multi-select') {
                const getOptionFromValue = (val) =>
                  field.options?.find((opt) => opt.value === val) || {
                    label: '',
                    value: '',
                  };

                const selectedObjects = (formData[field.name] || []).map((val) =>
                  getOptionFromValue(val)
                );

                return (
                  <Box key={index} sx={{ my: 1 }}>
                    <Autocomplete
                      multiple
                      disablePortal
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
            borderTop: 'thin solid var(--background_1)',
            gap: 1,
          }}
        >
          <Button onClick={onClose} disabled={isLoading}>
            Thoát
          </Button>
          <Button onClick={!isLoading ? handleSave : null} disabled={isLoading}>
            Lưu
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}

Popup_Form_0.propTypes = {
  /** Mở dialog không */
  open: PropTypes.bool.isRequired,

  /** Đóng dialog */
  onClose: PropTypes.func.isRequired,

  /** Tiêu đề dialog */
  title: PropTypes.string.isRequired,

  /** Mảng field form */
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

  /** Xử lý khi bấm Lưu */
  onSave: PropTypes.func.isRequired,

  /** Đang loading hay không */
  isLoading: PropTypes.bool,
};
