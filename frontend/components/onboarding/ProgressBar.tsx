interface Props {
  currentStep: number
  labels: string[]
}

export default function ProgressBar({ currentStep, labels }: Props) {
  const total = labels.length
  return (
    <div className="px-4 pt-4 pb-3">
      <div className="flex gap-1.5 mb-2">
        {labels.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              i < currentStep ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-gray-400">
        Step {currentStep} of {total} —{' '}
        <span className="font-semibold text-gray-600">{labels[currentStep - 1]}</span>
      </p>
    </div>
  )
}
