/**
 * Copyright 2014 Capital One Financial Corporation All Rights Reserved.
 */
(function() {
	'use strict';

	var DisputesApp = angular.module('cos.disputes', [
			'cos.disputes.templates', 'ngRoute', 'c1', 'ngSanitize',
			'DisputesServices', 'DisputesDirectives', 'c1.themeService' ]);

	DisputesApp
			.config(function($routeProvider) {
				$routeProvider
						.when(
								'/accounts/:accountId/transactions/:transactionId/:startDate/:endStart/disputes',
								{
									templateUrl : 'disputes/main.html',
									controller : 'disputesCtrl',
									title : 'cos.transactions.disputes.add_dispute.dispute_charge.page_title',
									resolve : {
										initialData : function(
												disputesInitialData, $route) {
											return disputesInitialData(
													$route.current.params.accountId,
													$route.current.params.transactionId,
													$route.current.params.startDate,
													$route.current.params.endStart);
										},
										easeTheme : function(ThemeService,
												$route) {
											if (ThemeService.ease.validRoute()) {
												angular.element('body')
														.removeClass('ready');
											}
											var idParam = $route.current.params.accountId
													|| null;
											return ThemeService.ease
													.check(idParam);
										}
									}
								});

				$routeProvider
						.when(
								'/accounts/:accountId/transactions/:transactionId/disputes/:status',
								{
									templateUrl : function(params) {
										return 'disputes/disputes'
												+ params.status + '.html';
									},
									title : 'cos.transactions.disputes.add_dispute.dispute_charge.page_title',
									controller : 'landingPageCtrl',
									resolve : {
										accountData : function($route) {
											return $route.current.params.accountId;
										},
										properties : function(
												httpRequestService) {
											return httpRequestService(
													'DisputesOptions',
													'get',
													'/api/accounts/disputes/properties',
													null);
										},
										status : function($route) {
											return $route.current.params.status;
										},
										easeTheme : function(ThemeService,
												$route) {
											if (ThemeService.ease.validRoute()) {
												angular.element('body')
														.removeClass('ready');
											}
											var idParam = $route.current.params.accountId
													|| null;
											return ThemeService.ease
													.check(idParam);
										}
									}
								});
			});

	/**
	 * If there are any rtm errors or system errors display them at the top of
	 * the screen in a beautiful pink div
	 */
	var displayErrors = function(disputesData, scope, logger, window) {
		if (disputesData !== undefined
				&& (disputesData.notices.rtmErrorSubmit || disputesData.notices.rtmErrorDNR)) {

			logger.info('Found some errors');
			logger.info(disputesData.notices);

			if (disputesData.notices.rtmErrorSubmit) {
				logger.info('Found Submit');
				scope.rtmCode = disputesData.notices.rtmErrorSubmit.eventCode;
				scope.rtmErrorStatus = disputesData.notices.rtmErrorSubmit.status;
				scope.rtmTransDetailCode = 10094;
				logger.debug('RTM Error Code: ' + scope.rtmCode);
				logger.debug('RTM Error Text: ' + scope.rtmErrorStatus);
			}

			if (disputesData.notices.rtmErrorDNR) {
				logger.info('Found DNR');
				scope.rtmCode = disputesData.notices.rtmErrorDNR.eventCode;
				scope.rtmErrorStatus = disputesData.notices.rtmErrorDNR.status;
				scope.rtmTransDetailCode = 10163;
				logger.debug('RTM Error Code: ' + scope.rtmCode);
				logger.debug('RTM Error Text: ' + scope.rtmErrorStatus);
			}

			scope.rtmError = true;
			window.scrollTo(0, 0);

		}
	};

	/**
	 * Controller for handling the confirmation and case closed/open pages.
	 */
	DisputesApp.controller('landingPageCtrl', function($scope, accountData,
			properties, status, chatService, publishers) {
		// accountID required to redirect to T&D page
		$scope.accountId = accountData;
		$scope.properties = properties;

		// override default page event publisher data
		var pubObj = {
			sectionName : 'accounts',
			pageName : 'disputes',
			scDLLevel4 : 'confirmation'
		};
		// publishing events to site catalyst
		publishers.activityEndEvent('file a dispute');
		publishers.pageViewEvent('disputes', pubObj);

		// send variables to chat, based upon the status
		// ('confirmation','casealreadyopen',etc)
		chatService.sendDataOnDisputesSubmit(status);
	});

	/**
	 * Controller for form submission
	 */
	DisputesApp
			.controller(
					'SubmitDisputeController',
					function($scope, Logger, $timeout, $window,
							submitFormService) {
						var logger = Logger.getLogger(DisputesApp.name
								+ '::SubmitDisputeController');

						$scope.requiredButMissing = function(property) {
							if ($scope.submittedForm === undefined) {
								return false;
							}
							return $scope.disputesForm[property].$error.required
									&& $scope.submitted
									&& $scope.submittedForm
											.hasOwnProperty(property);
						};

						$scope.prefillDisputeAmount = function(key, reason) {
							$scope.prefillDisputeAmtDisabled = false;
							$scope.doNotRecognizeDisputePartialAmount = false;

							// to ensure key is not null anytime
							if (key === undefined || key === null) {
								key = $scope.isFullAmountDisputed;
							}

							if (key === true) {
								$scope.amountDisputed = normalizeDecimalValue(
										''
												+ ($scope.disputesData.transactionAmount),
										$scope.region);
								$scope.isFullAmountDisputed = true;

								// IE8 Custom placeholder relies on changes to
								// view value so that
								// the value is validated during the
								// parsers.push (view->model) process
								// changing the value through the ngModel skips
								// this so we are forced to trigger
								// the validation update manually
								// tl;dr remove error from ie8 when button is
								// pressed
								$scope.$apply();
								$scope.disputesForm.disputed.$setValidity(
										'ie8Required', true);

								if ($scope.amountDisputed > 0) {
									angular.element(
											'#disputes_amount_error_exceed')
											.hide();
									angular.element(
											'#disputes_amount_error_check')
											.hide();
									angular.element('#disputed_amount')
											.removeClass('error_glow');
								}

								angular.element('#disputed_amount').blur();

							}

							if (key === false && $scope.isFullAmountDisputed) {
								$scope.amountDisputed = '';
								$scope.isFullAmountDisputed = false;
							}
							if (reason.disputesOption === 'notRecognized'
									&& key !== true) {
								$scope.doNotRecognizeDisputePartialAmount = true;
							}

						};

						var normalizeDecimalValue = function(value, region) {
							if (region === null
									|| region.decimalSeparator === null) {
								return value;
							}
							return value.replace('.', region.decimalSeparator);
						};

						$scope.resetForm = function() {
							$scope.submitted = false;
							$scope.selected.displayPrintForm = false;
							$scope.contactMerchant = false;
						};

						$scope.subtractCurrencies = function(subtractFrom,
								subtractAmount) {
							var subtractedCurrencies = ('' + subtractFrom)
									.replace($scope.region.decimalSeparator,
											'.')
									- ('' + subtractAmount)
											.replace(
													$scope.region.decimalSeparator,
													'.');

							if (isNaN(subtractedCurrencies)) {
								return subtractFrom;
							}
							return subtractedCurrencies;
						};

						$scope.callSubmit = function() {
							$scope.processingSubmit = true;

							function submit() {
								$scope.submitted = true;

								var disputesRequest = {};
								angular
										.forEach(
												$scope.disputesForm,
												function(value, key) {
													if (typeof value === 'object'
															&& value
																	.hasOwnProperty('$modelValue')) {
														if (key === 'reason') {
															disputesRequest[key] = value.$modelValue.disputesOption;
															disputesRequest.reasonText = value.$modelValue.disputesOptionText;
														} else if (key === 'paidBy') {
															disputesRequest[key] = value.$modelValue.disputesPaymentValue;
														} else if (key === 'disputed') {
															disputesRequest[key] = ('' + value.$modelValue)
																	.replace(
																			$scope.region.decimalSeparator,
																			'.');
														} else if (key === 'merchantContactMethod'
																|| key === 'merchantResponse') {
															if (value.$modelValue !== undefined) {
																disputesRequest[key] = value.$modelValue.code;
															}
														} else {
															disputesRequest[key] = value.$modelValue;
														}
													}
												});
								disputesRequest.dateTransactionStart = $scope.transStart;
								disputesRequest.dateTransactionEnd = $scope.transEnd;
								disputesRequest.accountId = $scope.accountId;
								disputesRequest.transactionId = $scope.transactionId;
								disputesRequest.chargedAmount = $scope.disputesData.transactionAmount;
								disputesRequest.merchantInfo = $scope.disputesData.merchantInfo;

								if ($scope.disputesForm.$valid) {
									logger
											.info('Sending form to disputes submission service');
									submitFormService(disputesRequest,
											$scope.accountId,
											$scope.transactionId)
											.then(
													function(response) {
														logger.debug(response);
														$scope.processingSubmit = false;

														if (response !== undefined
																&& response.notices) {
															// pass in parent
															// scope so we don't
															// shadow the errors
															// in this child
															// controller
															displayErrors(
																	response,
																	$scope.$parent,
																	logger,
																	$window);
														}
													});

								} else {
									$scope.processingSubmit = false;
									$scope.submittedForm = {};
									angular.copy($scope.disputesForm,
											$scope.submittedForm);
									$window.scrollTo(0, 0);
								}

							}

							$timeout(submit, 0);
						};

						$scope.setSelectedMerchantContactMethod = function(
								merchantContactMethod) {

							$scope.selectedMerchantContactMethod = merchantContactMethod;
							if (merchantContactMethod
									&& merchantContactMethod.disputeMerchantResponse !== '') {
								$scope.contactMerchant = true;
							} else {
								$scope.contactMerchant = false;
							}
						};
					});

	/**
	 * Function that gathers together all the initial scope setting values for
	 * the disputes page.
	 */
	var setInitalDataInScope = function(scope, routeParams, initialData,
			ThemeService) {
		scope.submitted = false;
		scope.rtmError = false;

		scope.accountId = routeParams.accountId;
		scope.disputesData = initialData.disputesData;
		scope.disputesOptions = initialData.disputesOptions;
		scope.transStart = initialData.transactionStartDate;
		scope.transEnd = initialData.transactionEndDate;
		scope.transactionId = initialData.transId;
		scope.startDate = routeParams.startDate;
		scope.endStart = routeParams.endStart;
		scope.processingSubmit = false;
		scope.today = new Date();

		scope.confirmChecked = {};
		scope.confirmChecked.value = false;

		scope.themeService = ThemeService;
	};

	/**
	 * Make sure this comes after the initial data setting function. Any
	 * functions that need to be set into scope.
	 */
	var setInitalScopeFunctions = function(scope, logger) {
		scope.setTemplate = function(reason) {
			if (reason === undefined) {
				reason = scope.disputesOptions[0];
			}
			logger.info('Setting template to: ' + reason.disputesTemplate);
			scope.template = reason.disputesTemplate;
			scope.contactMerchant = false;
		};
	};

	/**
	 * Setup any region specific items we need contained in an object for
	 * reference on dispute pages.
	 * 
	 */
	var setupRegionInformation = function(scope, i18nFilter) {
		scope.region = {
			dateFormat : i18nFilter('cos.common.date_format.short'),
			datePlaceHolder : i18nFilter('cos.transactions.disputes.add_dispute.dispute_date_format.label'),
			prefix : i18nFilter('cos.common.currency.prefix.text'),
			suffix : i18nFilter('cos.common.currency.suffix.text'),
			decimalSeparator : i18nFilter('cos.common.currency.format.decimal_separator'),
			thousandsSeparator : i18nFilter('cos.common.currency.format.thousands_separator') === 'space' ? ' '
					: i18nFilter('cos.common.currency.format.thousands_separator'),
			amountPlaceHolder : i18nFilter('cos.transactions.disputes.add_dispute.disputed_amount_field_example.label')
		};
	};

	/**
	 * Controller for initially loading the page.
	 */
	DisputesApp
			.controller(
					'disputesCtrl',
					function($scope, $rootScope, $routeParams, initialData,
							publishers, Logger, $window, httpRequestService,
							chatService, i18nFilter, ThemeService) {

						var logger = Logger.getLogger(DisputesApp.name
								+ '::disputesCtrl');

						setupRegionInformation($scope, i18nFilter);

						/**
						 * Publish surcharge radio button selection event to
						 * site catalyst
						 */
						$scope.publishRadioButtonEvent = function(value) {
							publishers.radioButtonSelectedEvent(value);
						};

						/**
						 * Publish cancel button event to site catalyst
						 */
						$scope.publishCancelButtonEvent = function() {
							publishers.buttonPressEvent('cancel');
						};

						$scope.showPrintPage = function() {
							$window.print();
						};

						setInitalDataInScope($scope, $routeParams, initialData,
								ThemeService);
						setInitalScopeFunctions($scope, logger);

						publishers.activityStartEvent('file a dispute');
						publishers.pageViewEvent('disputes');

						if (initialData !== undefined
								&& initialData.disputesData.notices) {
							displayErrors(initialData.disputesData, $scope,
									logger, $window);
						}

						$rootScope.loadingView = false;

						$scope.selected = $scope.disputesOptions[0];

						$scope.setSelectedReason = function(reason) {
							if (reason === undefined) {
								reason = $scope.disputesOptions[0];
							}
							$scope.selected = reason;
							$scope.contactMerchant = false;
							// send disputes reason to chat
							if (reason !== $scope.disputesOptions[0]) {
								chatService
										.sendDataOnDisputesReasonSelection(reason);
								// publish dropdown selection
								publishers
										.dropdownSelected(reason.siteCatalystValue);
							}

							logger.info('Setting selected reason:');
							logger.info(reason);
							$scope.rtmError = false; // reset in case of
														// previous error

							if (reason.disputesOption === 'notRecognized') {
								$rootScope.miniLoadingView = true;
								httpRequestService(
										'DoNotRecognizedIndicator',
										'get',
										'/api/accounts/' + $scope.accountId
												+ '/transactions/'
												+ $scope.transactionId + '/'
												+ $scope.transStart + '/'
												+ $scope.transEnd
												+ '/disputes/onlineIndicator',
										null)
										.then(
												function(response) {
													$scope.showCustomerInfoBox = !response.showCustomerInfoBox; // the
																												// indicator
																												// is
																												// flip
																												// flopped
													$rootScope.miniLoadingView = false;
													if (response !== undefined
															&& response.notices) {
														displayErrors(response,
																$scope, logger,
																$window);
													}
												});
							}
						};

						chatService
								.sendDataOnDisputesFormPageLoad(initialData.disputesData);
					});

	DisputesApp.filter('zeroOrAbove', function() {
		return function(input) {
			return (input && input >= 0) ? input : 0;
		};
	});
})();