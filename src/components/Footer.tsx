import React from 'react'

const Footer: React.FC = () => {
	return (
		<footer
			aria-label="Application footer"
			className="fixed bottom-0 left-0 right-0 w-screen z-50 pointer-events-auto"
			style={{ WebkitTransform: 'translateZ(0)' }}
		>
			<div className="w-full">
				<div className="w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-sm py-3">
					<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
						<p className="text-center text-sm text-slate-700 dark:text-slate-300 select-none">
							Copyright © 2026 | Excelsoft Technologies Ltd.
						</p>
					</div>
				</div>
			</div>
		</footer>
	)
}

export default Footer
