// config.js
// Centralized API configuration for Knowledge Base
const API_BASE_URL = "https://ailevate-poc.excelsoftcorp.com/aiapps/knowledgebase";
const API_QUIZ_GEN = "https://ailevate-poc.excelsoftcorp.com/aiapps/AIG/QuizGenApi";
export const API_ENDPOINTS = {
  GET_CUSTOMER_DATA: `${API_BASE_URL}/get-customer-data`,
  GET_CUSTOMER_DATA_SLASH: `${API_BASE_URL}/get-customer-data/`,
  GET_EXISTING_KB: `${API_BASE_URL}/get-existing-knowledgebase`,
  GET_KB_DETAILS: `${API_BASE_URL}/get_kb_details`,
  LIST_BOOK_IMAGES: `${API_BASE_URL}/list_book_images`,
  LIST_KB_FILES: `${API_BASE_URL}/list_kb_files`,
  // Document and image management endpoints
  PROCESS_DOCUMENTS: `${API_BASE_URL}/process_documents`,
  REMOVE_KB_FILES: `${API_BASE_URL}/remove-kb-files`,
  DOWNLOAD_KB_FILE: `${API_BASE_URL}/download_kb_file`,
  REMOVE_IMAGE: `${API_BASE_URL}/remove-image`,
  DELETE_KB_DATAS: `${API_BASE_URL}/delete-kb-datas`,
  UPLOAD_STUDY_LO: `${API_BASE_URL}/upload-study-lo`,
  // Option metadata and LOVs
  GET_METADATA: `${API_BASE_URL}/get-metadata`, // usage: `${GET_METADATA}/{id}`
  GET_BOOKS_DETAILS: `${API_BASE_URL}/get-books-details`,
  GET_CHAPTER_LO_DETAILS: `${API_BASE_URL}/get-chapter-lo-details`,
  UPDATE_CHAPTER_LO_DETAILS: `${API_BASE_URL}/update-chapter-lo-details`,
  DELETE_ALL_CHAPTER_LO_DETAILS: `${API_BASE_URL}/delete-chapter-lo-details`,
  GET_ORGANIZATION_DETAILS: `${API_BASE_URL}/get-organization-details`,
  GET_APPS: `${API_BASE_URL}/get-apps`,
  // External AIG quiz chapters
  AIG_CHAPTERS: `https://ailevate-poc.excelsoftcorp.com/aiapps/AIG/QuizGenApi/chapter`,
  // Add other endpoints here as needed (future-proofing)
  // Guidelines endpoints
  GET_GUIDELINE: `${API_BASE_URL}/get-guideline`,
  SAVE_GUIDELINE: `${API_BASE_URL}/save-guideline`,
  DELETE_GUIDELINE: `${API_BASE_URL}/delete-guideline`,
  DELETE_GUIDELINE_DOCUMENT: `${API_BASE_URL}/delete-guideline-document`,
  // Chat endpoint
  ASK_QUESTION: `${API_BASE_URL}/ask_question`,
  CHECK_KB: `${API_BASE_URL}/check-kb`,
  GET_AGENT_CONFIG: `${API_QUIZ_GEN}/get-agent-config`,
  INSERT_AGENT_CONFIG: `${API_QUIZ_GEN}/insert_agent_config`,
  // Static templates
  DOWNLOAD_STUDY_LO_TEMPLATE: `https://esknowledgebase.blob.core.windows.net/esaiknowledgebase/ChapterAndLODetails.csv`,
};

export default {
  API_BASE_URL,
  API_ENDPOINTS,
};
