# Rename Changelog

## [Model Update] - {PR_MERGE_DATE}

- Updated model selection to include latest GPT-4.1 models
- Changed model preference from text field to dropdown selector
- Added support for GPT-4.1, GPT-4.1-mini, and GPT-4.1-nano models
- Simplified model validation logic
- Eliminated model duplication by defining models only in package.json
- Removed OpenAI API model discovery and caching for improved performance

## [Initial Version] - 2023-07-19

- Initial release of the Rename extension
- Added support for generating AI-powered file name suggestions
- Implemented file renaming functionality
- Added OpenAI API key preference
- Support for PDFs, images, and text files 