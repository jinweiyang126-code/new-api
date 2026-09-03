/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useTranslation } from 'react-i18next'

import { getDefaultStats } from '../../constants'
import { StatCounter } from '../stat-counter'

interface StatsProps {
  className?: string
}

export function Stats(_props: StatsProps) {
  const { t } = useTranslation()
  const stats = getDefaultStats(t)

  return (
    <div className='relative z-10'>
      <div className='mx-auto max-w-[1200px] px-6 py-16 md:py-20'>
        <div className='grid grid-cols-2 gap-10 md:grid-cols-4 md:gap-12'>
          {stats.map((stat) => (
            <div
              key={stat.description}
              className='flex flex-col items-center text-center'
            >
              <span className='text-3xl font-semibold tracking-tight md:text-4xl'>
                <StatCounter end={stat.end} suffix={stat.suffix} />
              </span>
              <span className='text-muted-foreground mt-2 text-xs md:text-sm'>
                {stat.description}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
