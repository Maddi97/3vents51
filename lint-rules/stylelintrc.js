"use strict"


module.exports = {
	extends: "stylelint-config-standard",
	plugins: [
		"stylelint-no-browser-hacks/lib"
	],

	customSyntax: "postcss-html",
	"stylelint.validate": [// ↓ Add "html" language.
		"html",
	],
	rules: {
		"block-closing-brace-newline-after": "always",
		"color-no-invalid-hex": true,
		"block-no-empty": null,
		"indentation": 2,
		"property-no-unknown": true,
		"plugin/no-browser-hacks": [true, {
			"browsers": [
				"last 2 versions",
				"ie >=8"
			]
		}],
		"max-empty-lines": 1,
		"value-keyword-case": "lower",
		"at-rule-empty-line-before": null,
		"rule-empty-line-before": null,
	},
}
