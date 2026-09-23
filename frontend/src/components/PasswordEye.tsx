import React from 'react'
import { Eye, EyeOff } from "lucide-react";

function PasswordEye({ showPassword, setShowPassword }: { showPassword: boolean; setShowPassword: React.Dispatch<React.SetStateAction<boolean>> } ) {
  return (
       <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="text-gray-500"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
  )
}

export default PasswordEye
