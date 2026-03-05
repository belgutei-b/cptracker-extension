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
  textClassName = "plasmo-text-stone-200"
}: ComplexityFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="plasmo-mb-1 plasmo-block plasmo-text-xs plasmo-font-semibold plasmo-text-stone-300">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`plasmo-w-full plasmo-rounded-lg plasmo-border plasmo-border-[#3e3e3e] plasmo-bg-[#1f1f1f] plasmo-px-2 plasmo-py-2 plasmo-text-xs ${textClassName} placeholder:plasmo-text-stone-600`}
      />
    </div>
  )
}

export default ComplexityField
