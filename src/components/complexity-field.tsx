type ComplexityFieldProps = {
  id: string
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
  textClassName?: string
}

function ComplexityField({
  id,
  label,
  value,
  placeholder,
  onChange,
  textClassName = "plasmo-text-foreground"
}: ComplexityFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="plasmo-mb-1.5 plasmo-block plasmo-text-xs plasmo-font-medium plasmo-text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`plasmo-h-8 plasmo-w-full plasmo-rounded-lg plasmo-border plasmo-border-input plasmo-bg-input/30 plasmo-px-2.5 plasmo-font-mono plasmo-text-sm ${textClassName} placeholder:plasmo-text-muted-foreground focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-primary/50`}
      />
    </div>
  )
}

export default ComplexityField
