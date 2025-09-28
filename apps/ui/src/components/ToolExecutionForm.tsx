/* eslint-disable react-hooks/exhaustive-deps */
// apps/ui/src/components/ToolExecutionForm.tsx
import React, { useState, useEffect, useCallback } from "react";
import { Tool } from "@mcpconnect/schemas";
import { Play, Loader2, Plus, Trash2, Info } from "lucide-react";

interface ToolExecutionFormProps {
  tool: Tool;
  onExecute: (values: Record<string, any>) => Promise<void>;
  isExecuting: boolean;
  disabled?: boolean;
  initialValues?: Record<string, any> | null;
}

interface FormField {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  description?: string;
  required: boolean;
  default?: any;
}

export const ToolExecutionForm: React.FC<ToolExecutionFormProps> = ({
  tool,
  onExecute,
  isExecuting,
  disabled = false,
  initialValues = null,
}) => {
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  // Extract form fields from tool schema
  const formFields: FormField[] = React.useMemo(() => {
    const fields: FormField[] = [];

    if (tool.parameters) {
      // Use the parameters array if available
      return tool.parameters.map(param => ({
        name: param.name,
        type: param.type,
        description: param.description,
        required: param.required || false,
        default: param.default,
      }));
    }

    if (tool.inputSchema?.properties) {
      // Fall back to input schema
      const properties = tool.inputSchema.properties;
      const required = tool.inputSchema.required || [];

      for (const [name, schema] of Object.entries(properties)) {
        const fieldSchema = schema as any;
        fields.push({
          name,
          type: mapSchemaTypeToFieldType(fieldSchema.type || "string"),
          description: fieldSchema.description,
          // @ts-ignore
          required: required.includes(name),
          default: fieldSchema.default,
        });
      }
    }

    return fields;
  }, [tool]);

  // Initialize form values with defaults and initial values
  useEffect(() => {
    const defaultValues: Record<string, any> = {};

    formFields.forEach(field => {
      // Priority: initialValues > field.default > type defaults
      if (initialValues && initialValues[field.name] !== undefined) {
        defaultValues[field.name] = initialValues[field.name];
      } else if (field.default !== undefined) {
        defaultValues[field.name] = field.default;
      } else if (field.type === "boolean") {
        defaultValues[field.name] = false;
      } else if (field.type === "array") {
        defaultValues[field.name] = [];
      } else if (field.type === "object") {
        defaultValues[field.name] = {};
      } else {
        defaultValues[field.name] = "";
      }
    });

    setFormValues(defaultValues);
  }, [formFields, initialValues]);

  const mapSchemaTypeToFieldType = (schemaType: string): FormField["type"] => {
    switch (schemaType) {
      case "integer":
      case "number":
        return "number";
      case "boolean":
        return "boolean";
      case "array":
        return "array";
      case "object":
        return "object";
      default:
        return "string";
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    formFields.forEach(field => {
      const value = formValues[field.name];

      if (
        field.required &&
        (value === undefined || value === null || value === "")
      ) {
        errors[field.name] = `${field.name} is required`;
      }

      if (field.type === "number" && value !== "" && isNaN(Number(value))) {
        errors[field.name] = `${field.name} must be a valid number`;
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e) {
        e.preventDefault();
      }

      if (!validateForm() || disabled || isExecuting) {
        return;
      }

      try {
        // Convert form values to appropriate types
        const processedValues: Record<string, any> = {};

        formFields.forEach(field => {
          const rawValue = formValues[field.name];

          switch (field.type) {
            case "number":
              processedValues[field.name] =
                rawValue === "" ? undefined : Number(rawValue);
              break;
            case "boolean":
              processedValues[field.name] = Boolean(rawValue);
              break;
            case "object":
              try {
                processedValues[field.name] =
                  typeof rawValue === "string"
                    ? JSON.parse(rawValue)
                    : rawValue;
              } catch {
                processedValues[field.name] = rawValue;
              }
              break;
            case "array":
              if (Array.isArray(rawValue)) {
                processedValues[field.name] = rawValue;
              } else if (typeof rawValue === "string") {
                try {
                  processedValues[field.name] = JSON.parse(rawValue);
                } catch {
                  processedValues[field.name] = rawValue
                    .split(",")
                    .map(s => s.trim());
                }
              } else {
                processedValues[field.name] = [];
              }
              break;
            default:
              processedValues[field.name] = rawValue;
          }
        });

        await onExecute(processedValues);
      } catch (error) {
        console.error("Form submission error:", error);
      }
    },
    [formValues, formFields, validateForm, disabled, isExecuting, onExecute]
  );

  const updateFormValue = (fieldName: string, value: any) => {
    setFormValues(prev => ({ ...prev, [fieldName]: value }));

    // Clear validation error when user starts typing
    if (validationErrors[fieldName]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const renderArrayField = (field: FormField) => {
    const arrayValue = formValues[field.name] || [];

    const addItem = () => {
      updateFormValue(field.name, [...arrayValue, ""]);
    };

    const removeItem = (index: number) => {
      const newArray = arrayValue.filter((_: any, i: number) => i !== index);
      updateFormValue(field.name, newArray);
    };

    const updateItem = (index: number, value: string) => {
      const newArray = [...arrayValue];
      newArray[index] = value;
      updateFormValue(field.name, newArray);
    };

    return (
      <div className="space-y-3">
        {arrayValue.map((item: string, index: number) => (
          <div key={index} className="flex gap-3">
            <input
              type="text"
              value={item}
              onChange={e => updateItem(index, e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              placeholder={`Item ${index + 1}`}
            />
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="px-3 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-2 px-4 py-3 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors border border-dashed border-blue-300 dark:border-blue-600 w-full justify-center"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>
    );
  };

  const renderField = (field: FormField) => {
    const hasError = !!validationErrors[field.name];

    return (
      <div key={field.name} className="space-y-3">
        <div className="flex items-center gap-2">
          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
            {field.name}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {field.description && (
            <div className="group relative">
              <Info className="w-4 h-4 text-gray-400 cursor-help" />
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                {field.description}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-1">
          {field.type === "boolean" ? (
            <label className="flex items-center gap-3 p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={formValues[field.name] || false}
                onChange={e => updateFormValue(field.name, e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Enable {field.name}
                </span>
                {field.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {field.description}
                  </p>
                )}
              </div>
            </label>
          ) : field.type === "array" ? (
            renderArrayField(field)
          ) : field.type === "object" ? (
            <textarea
              value={
                typeof formValues[field.name] === "object"
                  ? JSON.stringify(formValues[field.name], null, 2)
                  : formValues[field.name] || ""
              }
              onChange={e => updateFormValue(field.name, e.target.value)}
              onKeyPress={handleKeyPress}
              className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm transition-colors ${
                hasError
                  ? "border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/10"
                  : "border-gray-200 dark:border-gray-600"
              }`}
              placeholder='{"key": "value"}'
              rows={4}
            />
          ) : (
            <input
              type={field.type === "number" ? "number" : "text"}
              value={formValues[field.name] || ""}
              onChange={e => updateFormValue(field.name, e.target.value)}
              onKeyPress={handleKeyPress}
              className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                hasError
                  ? "border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/10"
                  : "border-gray-200 dark:border-gray-600"
              }`}
              placeholder={field.description || `Enter ${field.name}`}
            />
          )}

          {hasError && (
            <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
              <span className="w-4 h-4 text-red-500">⚠</span>
              {validationErrors[field.name]}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Tool Info Header */}
      {initialValues && Object.keys(initialValues).length > 0 && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <span className="text-xs text-green-600 dark:text-green-400">
                ✓
              </span>
            </div>
            <h3 className="font-medium text-green-900 dark:text-green-100">
              Pre-filled Parameters
            </h3>
          </div>
          <p className="text-sm text-green-700 dark:text-green-300">
            Form has been pre-populated with values from a previous execution
          </p>
        </div>
      )}

      {/* No Parameters Message */}
      {formFields.length === 0 && (
        <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 text-center">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg mx-auto mb-3 flex items-center justify-center">
            <Play className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
            Ready to Execute
          </h3>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            This tool requires no parameters. Click the button below to execute
            it.
          </p>
        </div>
      )}

      {/* Form Fields */}
      {formFields.length > 0 && (
        <div className="space-y-6">
          <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Parameters
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Configure the parameters for tool execution
            </p>
          </div>

          <div className="space-y-6">{formFields.map(renderField)}</div>
        </div>
      )}

      {/* Submit Button */}
      <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          type="submit"
          disabled={disabled || isExecuting}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium text-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:hover:scale-100"
        >
          {isExecuting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Executing Tool...
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              Execute Tool
            </>
          )}
        </button>

        {/* Keyboard shortcut hint */}
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Press{" "}
            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs">
              Enter
            </kbd>{" "}
            to execute • Results will appear in the Request Inspector
          </p>
        </div>
      </div>
    </form>
  );
};
